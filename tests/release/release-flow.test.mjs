import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubReleaseApi } from '../../scripts/github-release-api.mjs';
import { reconcileReleases } from '../../scripts/release-engine.mjs';

function zip(directory, name, files) {
  const archive = join(directory, name);
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(directory, path), content);
  }
  execFileSync('zip', ['-q', archive, ...Object.keys(files)], { cwd: directory });
  return readFileSync(archive);
}

function metadata(version) {
  return {
    'package.json': JSON.stringify({ name: 'example', version }),
    'package-lock.json': JSON.stringify({
      name: 'example',
      version,
      packages: { '': { name: 'example', version } },
    }),
    'manifest.json': JSON.stringify({ version, minAppVersion: '1.6.0' }),
    'versions.json': JSON.stringify({ [version]: '1.6.0' }),
  };
}

function mockRepository(directory, afterVersion = '1.0.1') {
  const before = 'a'.repeat(40);
  const after = 'b'.repeat(40);
  const versions = { [before]: metadata('1.0.0'), [after]: metadata(afterVersion) };
  const pluginZip = zip(directory, 'plugin.zip', {
    'main.js': 'bundle',
    'manifest.json': versions[after]['manifest.json'],
    'styles.css': 'styles',
  });
  const coverageZip = zip(directory, 'coverage.zip', {
    'coverage-summary.json': JSON.stringify({
      total: { lines: { pct: 94 }, branches: { pct: 88 } },
    }),
  });
  const state = {
    head: before,
    issues: [],
    releases: [],
    assets: [],
    ref: null,
    runConclusion: 'success',
    published: 0,
  };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const checks = [
    'Validate version',
    'Typecheck',
    'Lint',
    'Format',
    'Test and coverage',
    'Production build',
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (value, options) => {
      const url = new URL(value);
      const route = url.pathname.replace('/repos/owner/project', '');
      const method = options.method;
      if (route === '/issues' && method === 'GET') {
        return json(state.issues);
      }
      if (route === '/issues' && method === 'POST') {
        const issue = {
          ...JSON.parse(options.body),
          number: state.issues.length + 1,
          user: { login: 'github-actions[bot]' },
        };
        state.issues.push(issue);
        return json(issue, 201);
      }
      if (/^\/issues\/\d+$/.test(route)) {
        const issue = state.issues[Number(route.split('/').at(-1)) - 1];
        if (method === 'PATCH') {
          Object.assign(issue, JSON.parse(options.body));
        }
        return json(issue);
      }
      if (route === '/git/ref/heads/main') {
        return json({ object: { sha: state.head } });
      }
      if (route === `/compare/${before}...${after}`) {
        return json({ status: 'ahead', merge_base_commit: { sha: before } });
      }
      if (route === '/actions/workflows/ci.yml/runs') {
        return json({
          workflow_runs: [
            {
              id: 10,
              head_sha: after,
              head_branch: 'main',
              event: 'push',
              status: 'completed',
              conclusion: state.runConclusion,
              html_url: 'https://github.com/owner/project/actions/runs/10',
            },
          ],
        });
      }
      if (route === '/actions/runs/10/jobs') {
        return json({
          jobs: [
            {
              name: 'validate',
              conclusion: 'success',
              steps: checks.map((name) => ({ name, conclusion: 'success' })),
            },
          ],
        });
      }
      if (route === '/actions/runs/10/artifacts') {
        return json({
          artifacts: [
            { id: 11, name: `plugin-${after}`, expired: false },
            { id: 12, name: `coverage-${after}`, expired: false },
          ],
        });
      }
      if (route === '/actions/artifacts/11/zip') {
        return new Response(pluginZip);
      }
      if (route === '/actions/artifacts/12/zip') {
        return new Response(coverageZip);
      }
      if (route.startsWith('/contents/')) {
        const path = route.slice('/contents/'.length);
        const content = versions[url.searchParams.get('ref')]?.[path];
        return content === undefined
          ? json({}, 404)
          : json({ encoding: 'base64', content: Buffer.from(content).toString('base64') });
      }
      if (route === '/releases' && method === 'GET') {
        return json(state.releases);
      }
      if (route === '/git/ref/tags/1.0.1') {
        return state.ref ? json(state.ref) : json({}, 404);
      }
      if (route === '/git/refs' && method === 'POST') {
        state.ref = { object: { type: 'commit', sha: JSON.parse(options.body).sha } };
        return json(state.ref, 201);
      }
      if (route === '/releases' && method === 'POST') {
        const release = {
          ...JSON.parse(options.body),
          id: 1,
          upload_url:
            'https://uploads.github.com/repos/owner/project/releases/1/assets{?name,label}',
        };
        state.releases.push(release);
        return json(release, 201);
      }
      if (route === '/releases/1/assets' && method === 'GET') {
        return json(state.assets.map(({ data: _data, ...asset }) => asset));
      }
      if (route === '/releases/1/assets' && method === 'POST') {
        const asset = {
          id: state.assets.length + 1,
          name: url.searchParams.get('name'),
          data: Buffer.from(options.body),
        };
        state.assets.push(asset);
        return json({ id: asset.id, name: asset.name }, 201);
      }
      if (route.startsWith('/releases/assets/')) {
        const asset = state.assets.find((item) => item.id === Number(route.split('/').at(-1)));
        return asset ? new Response(asset.data) : json({}, 404);
      }
      if (route === '/releases/1' && method === 'PATCH') {
        state.releases[0].draft = false;
        state.published += 1;
        return json(state.releases[0]);
      }
      throw new Error(`Unexpected mock GitHub request: ${method} ${route}`);
    }),
  );
  const api = new GitHubReleaseApi({
    token: 'test-token',
    repository: 'owner/project',
    runId: '123',
    runUrl: 'https://github.com/owner/project/actions/runs/123',
  });
  return { api, state, before, after };
}

afterEach(() => vi.unstubAllGlobals());

describe('release flow using a simulated GitHub API', () => {
  it.runIf(spawnSync('zip', ['-v']).status === 0 && spawnSync('unzip', ['-v']).status === 0)(
    'consumes a validated no-bump push without creating a release',
    async () => {
      const directory = mkdtempSync(join(tmpdir(), 'habit-release-flow-'));
      try {
        const { api, state, before, after } = mockRepository(directory, '1.0.0');
        await api.initialize(before);
        await api.capture(before, after);
        state.head = after;
        expect((await reconcileReleases(api)).waitingFor).toBe('idle');
        expect((await api.readCursor()).lastConsumed).toBe(after);
        expect((await api.readCursor()).lastReconciledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect((await api.listReceipts())[0]).toMatchObject({
          status: 'validation-only-complete',
          bumpClassification: 'unchanged',
        });
        expect(state.releases).toHaveLength(0);
        expect(state.published).toBe(0);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it.runIf(spawnSync('zip', ['-v']).status === 0 && spawnSync('unzip', ['-v']).status === 0)(
    'blocks a failed CI run, records the failure, then publishes and retries idempotently',
    async () => {
      const directory = mkdtempSync(join(tmpdir(), 'habit-release-flow-'));
      try {
        const { api, state, before, after } = mockRepository(directory);
        await api.initialize(before);
        await api.capture(before, after);
        state.head = after;
        state.runConclusion = 'failure';
        await expect(reconcileReleases(api)).rejects.toThrow('CI validation failed');
        expect((await api.readCursor()).lastConsumed).toBe(before);
        expect((await api.listReceipts())[0]).toMatchObject({
          status: 'blocked',
          error: expect.stringContaining('CI validation failed'),
        });
        expect(state.releases).toHaveLength(0);
        state.runConclusion = 'success';
        expect((await reconcileReleases(api)).waitingFor).toBe('idle');
        expect((await api.readCursor()).lastConsumed).toBe(after);
        expect((await api.listReceipts())[0]).toMatchObject({
          status: 'published',
          bumpClassification: 'bump',
          validation: { sourceSha: after, coverage: { lines: 94, branches: 88 } },
        });
        expect(state.releases[0].draft).toBe(false);
        expect(state.assets.map((asset) => asset.name)).toEqual([
          'main.js',
          'manifest.json',
          'styles.css',
        ]);
        expect((await reconcileReleases(api)).waitingFor).toBe('idle');
        expect(state.published).toBe(1);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
