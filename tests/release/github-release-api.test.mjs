import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubReleaseApi } from '../../scripts/github-release-api.mjs';
import { reconcileReleases } from '../../scripts/release-engine.mjs';

function fakeGithub() {
  const state = {
    ref: null,
    tags: {},
    releases: [],
    storedAssets: [],
    failUpload: null,
    publications: 0,
  };
  const build = {
    'main.js': Buffer.from('bundle'),
    'manifest.json': Buffer.from('manifest'),
    'styles.css': Buffer.from('styles'),
  };
  const sha = 'a'.repeat(40);
  function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const fetchMock = vi.fn(async (url, options) => {
    const parsed = new URL(url);
    const route = parsed.pathname.replace('/repos/owner/project', '');
    const method = options.method;
    if (method === 'GET' && route === '/releases') {
      return json(state.releases);
    }
    if (method === 'GET' && route === '/git/ref/tags/1.0.1') {
      return state.ref ? json(state.ref) : json({}, 404);
    }
    if (method === 'POST' && route === '/git/refs') {
      state.ref = { object: { type: 'commit', sha: JSON.parse(options.body).sha } };
      return json(state.ref, 201);
    }
    if (method === 'GET' && route.startsWith('/git/tags/')) {
      const object = state.tags[route.split('/').at(-1)];
      return object ? json({ object }) : json({}, 404);
    }
    if (method === 'POST' && route === '/releases') {
      const body = JSON.parse(options.body);
      const release = {
        ...body,
        id: 1,
        upload_url: 'https://uploads.github.com/repos/owner/project/releases/1/assets{?name,label}',
      };
      state.releases.push(release);
      return json(release, 201);
    }
    if (method === 'GET' && route === '/releases/1/assets') {
      return json(state.storedAssets.map(({ data: _data, ...asset }) => asset));
    }
    if (method === 'POST' && route === '/releases/1/assets') {
      const name = parsed.searchParams.get('name');
      if (state.failUpload === name) {
        return json({}, 503);
      }
      const asset = { id: state.storedAssets.length + 1, name, data: Buffer.from(options.body) };
      state.storedAssets.push(asset);
      return json({ id: asset.id, name }, 201);
    }
    if (method === 'GET' && route.startsWith('/releases/assets/')) {
      const asset = state.storedAssets.find(
        (entry) => entry.id === Number(route.split('/').at(-1)),
      );
      return asset ? new Response(asset.data) : json({}, 404);
    }
    if (method === 'PATCH' && route === '/releases/1') {
      state.releases[0].draft = false;
      state.publications += 1;
      return json(state.releases[0]);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const api = new GitHubReleaseApi({ token: 'secret', repository: 'owner/project' });
  const candidate = {
    version: '1.0.1',
    sha,
    validation: {
      html_url: 'https://github.com/owner/project/actions/runs/1',
    },
    build,
  };
  return { state, build, api, candidate };
}

afterEach(() => vi.unstubAllGlobals());

describe('GitHub release safety', () => {
  it('publishes only after all assets are uploaded and verified, and retries idempotently', async () => {
    const { state, api, candidate } = fakeGithub();
    await api.publishRelease(candidate);
    await api.publishRelease(candidate);
    expect(state.publications).toBe(1);
    expect(state.storedAssets.map((asset) => asset.name)).toEqual([
      'main.js',
      'manifest.json',
      'styles.css',
    ]);
    expect(state.releases[0].draft).toBe(false);
    expect(state.ref.object.sha).toBe(candidate.sha);
    expect(state.releases[0].body).toContain(
      `main.js: sha256:${createHash('sha256').update(candidate.build['main.js']).digest('hex')}`,
    );
    expect(state.releases[0].body).toContain(candidate.validation.html_url);
    expect(state.releases[0].body).not.toContain('Platform record:');
  });

  it('leaves incomplete releases in draft and safely resumes an upload', async () => {
    const { state, api, candidate } = fakeGithub();
    state.failUpload = 'manifest.json';
    await expect(api.publishRelease(candidate)).rejects.toThrow('(503)');
    expect(state.releases[0].draft).toBe(true);
    expect(state.publications).toBe(0);
    state.failUpload = null;
    await api.publishRelease(candidate);
    expect(state.publications).toBe(1);
    expect(state.storedAssets).toHaveLength(3);
  });

  it('accepts an annotated tag when it resolves to the validated commit', async () => {
    const { state, api, candidate } = fakeGithub();
    const annotated = 'd'.repeat(40);
    state.ref = { object: { type: 'tag', sha: annotated } };
    state.tags[annotated] = { type: 'commit', sha: candidate.sha };
    await api.publishRelease(candidate);
    expect(state.ref.object).toEqual({ type: 'tag', sha: annotated });
    expect(state.publications).toBe(1);
  });

  it('refuses an annotated tag that points back to itself', async () => {
    const { state, api, candidate } = fakeGithub();
    const annotated = 'd'.repeat(40);
    state.ref = { object: { type: 'tag', sha: annotated } };
    state.tags[annotated] = { type: 'tag', sha: annotated };
    await expect(api.publishRelease(candidate)).rejects.toThrow('cyclic');
    expect(state.publications).toBe(0);
  });

  it('never fills in missing assets on an already published release', async () => {
    const { state, api, candidate } = fakeGithub();
    await api.publishRelease(candidate);
    state.storedAssets = state.storedAssets.filter((asset) => asset.name !== 'styles.css');
    await expect(api.publishRelease(candidate)).rejects.toThrow('missing styles.css');
    expect(state.publications).toBe(1);
    expect(state.storedAssets).toHaveLength(2);
  });

  it('refuses foreign tags, foreign releases, and changed published assets', async () => {
    const foreignTag = fakeGithub();
    foreignTag.state.ref = { object: { type: 'commit', sha: 'b'.repeat(40) } };
    await expect(foreignTag.api.publishRelease(foreignTag.candidate)).rejects.toThrow(
      'another source',
    );
    const foreignRelease = fakeGithub();
    foreignRelease.state.releases.push({
      id: 1,
      tag_name: '1.0.1',
      body: 'unrelated',
      draft: true,
    });
    await expect(foreignRelease.api.publishRelease(foreignRelease.candidate)).rejects.toThrow(
      'not owned',
    );
    const changed = fakeGithub();
    await changed.api.publishRelease(changed.candidate);
    changed.state.storedAssets[0].data = Buffer.from('altered');
    await expect(changed.api.publishRelease(changed.candidate)).rejects.toThrow('differs');
    expect(changed.state.publications).toBe(1);
  });

  it('never publishes an older version over a later stable release', async () => {
    const { state, api, candidate } = fakeGithub();
    state.releases.push({ tag_name: '1.1.0', draft: false, prerelease: false });
    await expect(api.publishRelease(candidate)).rejects.toThrow('not older');
    expect(state.publications).toBe(0);
  });

  it('stops if a previous stable release has an unrecognized version tag', async () => {
    const { state, api, candidate } = fakeGithub();
    state.releases.push({ tag_name: 'v2.0.0', draft: false, prerelease: false });
    await expect(api.publishRelease(candidate)).rejects.toThrow('cannot verify release order');
    expect(state.publications).toBe(0);
  });

  it('does not send the token to an unexpected upload endpoint', async () => {
    const { api } = fakeGithub();
    await expect(
      api.request('https://attacker.example/assets', {
        method: 'POST',
        body: Buffer.from('x'),
        binary: true,
      }),
    ).rejects.toThrow('unexpected host');
  });

  it('reports unavailable GitHub permissions without disclosing the token', async () => {
    const { api } = fakeGithub();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 403 }));
    await expect(api.request('/repos/owner/project/releases')).rejects.toThrow('(403)');
    try {
      await api.request('/repos/owner/project/releases');
    } catch (error) {
      expect(error.message).not.toContain('secret');
    }
  });

  it('blocks at the pagination limit instead of accepting a partial ledger', async () => {
    const { api } = fakeGithub();
    api.request = async () => Array.from({ length: 100 }, (_, id) => ({ id }));
    await expect(api.pages('/repos/owner/project/issues')).rejects.toThrow('pagination limit');
  });

  it('accepts only a forward ancestry comparison', async () => {
    const { api } = fakeGithub();
    const before = 'a'.repeat(40);
    const after = 'b'.repeat(40);
    api.request = async () => ({ status: 'ahead', merge_base_commit: { sha: before } });
    expect(await api.isAncestor(before, after)).toBe(true);
    api.request = async () => ({ status: 'diverged', merge_base_commit: { sha: before } });
    expect(await api.isAncestor(before, after)).toBe(false);
    api.request = async () => {
      throw new Error('commit not found');
    };
    await expect(api.isAncestor(before, after)).rejects.toThrow('commit not found');
  });

  it('advances the cursor only after the reconciler publishes the verified candidate', async () => {
    const { state, api, candidate } = fakeGithub();
    const before = 'b'.repeat(40);
    let cursor = { baseline: before, lastConsumed: before };
    api.readCursor = async () => cursor;
    api.readMainHead = async () => candidate.sha;
    api.listReceipts = async () => [{ before, after: candidate.sha }];
    api.isAncestor = async () => true;
    api.validatedRun = async () => candidate.validation;
    api.readMetadata = async (sha) => {
      const version = sha === before ? '1.0.0' : '1.0.1';
      return {
        pkg: { name: 'example', version },
        lock: { name: 'example', version, packages: { '': { name: 'example', version } } },
        manifest: { version, minAppVersion: '1.6.0' },
        versions: { [version]: '1.6.0' },
      };
    };
    api.readBuild = async () => candidate.build;
    api.updateReceipt = async () => {};
    api.updateCursor = async (next) => {
      expect(state.releases[0].draft).toBe(false);
      cursor = next;
    };
    await reconcileReleases(api);
    expect(cursor.lastConsumed).toBe(candidate.sha);
    expect(state.publications).toBe(1);
  });
});

describe('exact-revision CI evidence', () => {
  function evidence() {
    const sha = 'a'.repeat(40);
    const checks = [
      'Validate version',
      'Typecheck',
      'Lint',
      'Format',
      'Test and coverage',
      'Production build',
    ];
    const run = {
      id: 1,
      head_sha: sha,
      head_branch: 'main',
      event: 'push',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/owner/project/actions/runs/1',
    };
    const job = {
      name: 'validate',
      conclusion: 'success',
      steps: checks.map((name) => ({ name, conclusion: 'success' })),
    };
    const api = new GitHubReleaseApi({ token: 'secret', repository: 'owner/project' });
    api.pages = async (path) => (path.includes('/jobs') ? [job] : [run]);
    api.readArtifact = async () => ({
      'coverage-summary.json': Buffer.from(
        JSON.stringify({ total: { lines: { pct: 90 }, branches: { pct: 85 } } }),
      ),
    });
    api.fileAt = async (_sha, name, optional) => {
      if (name === 'manifest.json') {
        return Buffer.from('{"version":"1.0.0"}');
      }
      if (optional) {
        return null;
      }
      throw new Error(`Unexpected file requested: ${name}`);
    };
    return { api, sha, run, job };
  }

  it('accepts the exact validated revision and measured coverage without a platform record', async () => {
    const { api, sha } = evidence();
    const validation = await api.validatedRun(sha);
    expect(validation.coverage).toEqual({
      lines: 90,
      branches: 85,
      thresholds: { lines: 80, branches: 80 },
      exception: null,
    });
    expect(validation.checks['Test and coverage']).toBe('success');
    expect(validation.head_sha).toBe(sha);
  });

  it('does not accept the wrong SHA, failed run, missing check, or invalid evidence', async () => {
    const wrong = evidence();
    expect(await wrong.api.validatedRun('b'.repeat(40))).toBeNull();
    const failed = evidence();
    failed.run.conclusion = 'failure';
    await expect(failed.api.validatedRun(failed.sha)).rejects.toThrow('CI validation failed');
    const missing = evidence();
    missing.job.steps = missing.job.steps.filter((step) => step.name !== 'Lint');
    await expect(missing.api.validatedRun(missing.sha)).rejects.toThrow('required check');
    const invalid = evidence();
    invalid.api.readArtifact = async () => ({
      'coverage-summary.json': Buffer.from('{"total":{"lines":{"pct":-1}}}'),
    });
    await expect(invalid.api.validatedRun(invalid.sha)).rejects.toThrow('invalid coverage');
    const below = evidence();
    below.api.readArtifact = async () => ({
      'coverage-summary.json': Buffer.from('{"total":{"lines":{"pct":79},"branches":{"pct":85}}}'),
    });
    await expect(below.api.validatedRun(below.sha)).rejects.toThrow('below the applicable');
  });

  it('associates an applicable approved coverage record with the exact source', async () => {
    const { api, sha } = evidence();
    const originalFileAt = api.fileAt;
    const record = {
      version: '1.0.0',
      scope: 'Release coverage',
      reason: 'Temporarily unavailable fixture',
      risk: 'Some branch paths lack coverage',
      remediation: 'Add tests in the next release',
      approvedBy: 'maintainer',
      approvalUrl: 'https://github.com/owner/project/pull/1#issuecomment-2',
      expiresOn: '2099-12-31',
      thresholds: { lines: 75, branches: 75 },
    };
    api.fileAt = async (source, name, optional) =>
      name.endsWith('coverage-exception.json')
        ? Buffer.from(JSON.stringify(record))
        : originalFileAt(source, name, optional);
    api.readArtifact = async () => ({
      'coverage-summary.json': Buffer.from('{"total":{"lines":{"pct":79},"branches":{"pct":77}}}'),
    });
    const result = await api.validatedRun(sha);
    expect(result.coverage).toMatchObject({
      lines: 79,
      branches: 77,
      thresholds: { lines: 75, branches: 75 },
      exception: { approvedBy: 'maintainer' },
    });
  });
});

describe('release ledger', () => {
  function ledger(releases = []) {
    const issues = [];
    const main = 'a'.repeat(40);
    function json(value, status = 200) {
      return new Response(JSON.stringify(value), { status });
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        const route = new URL(url).pathname.replace('/repos/owner/project', '');
        if (route === '/issues' && options.method === 'GET') {
          return json(issues);
        }
        if (route === '/releases' && options.method === 'GET') {
          return json(releases);
        }
        if (route === '/git/ref/heads/main' && options.method === 'GET') {
          return json({ object: { sha: main } });
        }
        if (route === '/issues' && options.method === 'POST') {
          const issue = {
            ...JSON.parse(options.body),
            user: { login: 'github-actions[bot]' },
            number: issues.length + 1,
          };
          issues.push(issue);
          return json(issue, 201);
        }
        if (route.startsWith('/issues/') && options.method === 'GET') {
          return json(issues[Number(route.split('/').at(-1)) - 1]);
        }
        if (route.startsWith('/issues/') && options.method === 'PATCH') {
          const issue = issues[Number(route.split('/').at(-1)) - 1];
          Object.assign(issue, JSON.parse(options.body));
          return json(issue);
        }
        throw new Error(`Unexpected request: ${options.method} ${url}`);
      }),
    );
    return {
      issues,
      main,
      api: new GitHubReleaseApi({
        token: 'secret',
        repository: 'owner/project',
        runId: '123',
        runUrl: 'https://github.com/owner/project/actions/runs/123',
      }),
    };
  }

  it('requires the current main head for a one-time baseline and records each push once', async () => {
    const { issues, main, api } = ledger();
    await expect(api.initialize('b'.repeat(40))).rejects.toThrow('current main');
    await api.initialize(main);
    await expect(api.initialize(main)).rejects.toThrow('already exists');
    const after = 'b'.repeat(40);
    await api.capture(main, after);
    await api.capture(main, after);
    expect(issues).toHaveLength(2);
    expect(issues[1].state).toBe('closed');
    expect(await api.listReceipts()).toMatchObject([
      { before: main, after, issue: 2, deliveryId: '123', status: 'captured' },
    ]);
    const cursor = await api.readCursor();
    await api.updateCursor({ ...cursor, lastConsumed: after });
    expect(await api.readCursor()).toMatchObject({ baseline: main, lastConsumed: after });
  });

  it('keeps receipt identity immutable and records reconciliation status safely', async () => {
    const { issues, main, api } = ledger();
    await api.initialize(main);
    const after = 'b'.repeat(40);
    await api.capture(main, after);
    await expect(api.capture(main, 'c'.repeat(40))).rejects.toThrow('different push');
    const receipt = (await api.listReceipts())[0];
    await api.updateReceipt(receipt, {
      status: 'validated',
      validation: { sourceSha: after },
      bumpClassification: 'bump',
    });
    const updated = (await api.listReceipts())[0];
    expect(updated).toMatchObject({
      deliveryId: '123',
      before: main,
      after,
      status: 'validated',
      bumpClassification: 'bump',
      validation: { sourceSha: after },
    });
    issues[1].body = issues[1].body.replace(after, 'c'.repeat(40));
    await expect(api.updateReceipt(receipt, { status: 'published' })).rejects.toThrow(
      'changed unexpectedly',
    );
    expect(api.redact('credential secret is hidden')).toBe('credential [redacted] is hidden');
  });

  it('fails closed on a forged or malformed issue instead of trusting it', async () => {
    const { issues, main, api } = ledger();
    await api.initialize(main);
    issues[0].user.login = 'other-user';
    await expect(api.readCursor()).rejects.toThrow('Untrusted');
    issues[0].user.login = 'github-actions[bot]';
    issues[0].body = '<!-- habit-rhythm-release-cursor:v1 -->\nnot-json';
    await expect(api.readCursor()).rejects.toThrow('Malformed');
  });

  it('initializes the cursor with the highest already-published stable version', async () => {
    const { main, api } = ledger([
      { tag_name: '1.1.0', draft: false, prerelease: false },
      { tag_name: '1.2.0', draft: false, prerelease: false },
      { tag_name: '2.0.0', draft: true, prerelease: false },
    ]);
    await api.initialize(main);
    expect(await api.readCursor()).toMatchObject({
      baseline: main,
      lastConsumed: main,
      latestPublishedVersion: '1.2.0',
      latestPublishedTag: '1.2.0',
      lastReconciledAt: null,
    });
  });
});

describe('validated build artifact', () => {
  it.runIf(spawnSync('zip', ['-v']).status === 0 && spawnSync('unzip', ['-v']).status === 0)(
    'accepts the exact asset set and refuses a changed manifest or unexpected file',
    async () => {
      const directory = mkdtempSync(join(tmpdir(), 'habit-artifact-test-'));
      try {
        const expected = {
          'main.js': 'bundle',
          'manifest.json': '{"version":"1.0.1"}',
          'styles.css': 'styles',
        };
        for (const [name, content] of Object.entries(expected)) {
          writeFileSync(join(directory, name), content);
        }
        const archivePath = join(directory, 'build.zip');
        execFileSync('zip', ['-q', archivePath, ...Object.keys(expected)], { cwd: directory });
        let archive = readFileSync(archivePath);
        let manifest = Buffer.from(expected['manifest.json']);
        const sha = 'a'.repeat(40);
        const api = new GitHubReleaseApi({ token: 'secret', repository: 'owner/project' });
        api.pages = async () => [{ name: `plugin-${sha}`, id: 1, expired: false }];
        api.request = async () => archive;
        api.fileAt = async () => manifest;
        const result = await api.readBuild({ id: 1 }, sha);
        expect(result['main.js'].toString()).toBe(expected['main.js']);
        manifest = Buffer.from('different');
        await expect(api.readBuild({ id: 1 }, sha)).rejects.toThrow('differs from committed');
        manifest = Buffer.from(expected['manifest.json']);
        writeFileSync(join(directory, 'extra.txt'), 'unexpected');
        execFileSync('zip', ['-q', archivePath, 'extra.txt'], { cwd: directory });
        archive = readFileSync(archivePath);
        await expect(api.readBuild({ id: 1 }, sha)).rejects.toThrow('exactly');
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
