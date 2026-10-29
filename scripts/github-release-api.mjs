import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareVersions, parseVersion } from './version-metadata.mjs';
import { coverageThresholds } from './coverage-policy.mjs';
import { requireSuccessfulChecks, selectValidationRun } from './validation-gate.mjs';

const cursorMarker = '<!-- habit-rhythm-release-cursor:v1 -->';
const receiptMarker = '<!-- habit-rhythm-release-receipt:v1 -->';
const assets = ['main.js', 'manifest.json', 'styles.css'];
const shaPattern = /^[0-9a-f]{40}$/;

function extractArtifact(archive, names) {
  const directory = mkdtempSync(join(tmpdir(), 'habit-release-'));
  try {
    const path = join(directory, 'build.zip');
    writeFileSync(path, archive);
    const actual = execFileSync('unzip', ['-Z', '-1', path], { encoding: 'utf8' })
      .trim()
      .split('\n');
    if (
      actual.length !== names.length ||
      names.some((name) => actual.filter((item) => item === name).length !== 1)
    ) {
      throw new Error(`Artifact must contain exactly ${names.join(', ')}`);
    }
    return Object.fromEntries(
      names.map((name) => [
        name,
        execFileSync('unzip', ['-p', path, name], { maxBuffer: 20 * 1024 * 1024 }),
      ]),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function encoded(marker, data) {
  return `${marker}\n${JSON.stringify(data, null, 2)}\n`;
}

function decode(issue, marker) {
  if (!issue.body?.startsWith(marker)) {
    return null;
  }
  if (issue.user?.login !== 'github-actions[bot]') {
    throw new Error(`Untrusted ledger issue #${issue.number}`);
  }
  try {
    return JSON.parse(issue.body.slice(marker.length));
  } catch {
    throw new Error(`Malformed ledger issue #${issue.number}`);
  }
}

function verifySha(value, allowZero = false) {
  if (!shaPattern.test(value ?? '') || (!allowZero && /^0+$/.test(value))) {
    throw new Error('Invalid commit SHA');
  }
  return value;
}

export class GitHubReleaseApi {
  constructor({
    token,
    repository,
    apiUrl = 'https://api.github.com',
    runUrl = '',
    runId = '',
    serverUrl = 'https://github.com',
  }) {
    if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
      throw new Error('A GitHub token and owner/repository are required');
    }
    this.token = token;
    this.repository = repository;
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.root = `/repos/${repository}`;
    this.runUrl = runUrl;
    this.runId = String(runId);
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.cursorIssue = null;
  }

  async request(path, options = {}) {
    const {
      method = 'GET',
      body,
      accept = 'application/vnd.github+json',
      binary = false,
      optional = false,
    } = options;
    const url = path.startsWith('https://') ? path : `${this.apiUrl}${path}`;
    const parsed = new URL(url);
    const apiOrigin = new URL(this.apiUrl).origin;
    if (parsed.origin !== apiOrigin && parsed.origin !== 'https://uploads.github.com') {
      throw new Error('Refusing to send credentials to an unexpected host');
    }
    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'habit-rhythm-release',
    };
    if (body !== undefined) {
      headers['Content-Type'] = binary ? 'application/octet-stream' : 'application/json';
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    });
    if (optional && response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${parsed.pathname} failed (${response.status})`);
    }
    if (accept === 'application/octet-stream') {
      return Buffer.from(await response.arrayBuffer());
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  async pages(path, field) {
    const all = [];
    for (let page = 1; page <= 100; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const result = await this.request(`${path}${separator}per_page=100&page=${page}`);
      const entries = field ? result[field] : result;
      if (!Array.isArray(entries)) {
        throw new Error('Unexpected GitHub pagination response');
      }
      all.push(...entries);
      if (entries.length < 100) {
        return all;
      }
    }
    throw new Error('GitHub pagination limit reached; manual reconciliation required');
  }

  async issues() {
    return (await this.pages(`${this.root}/issues?state=all`)).filter(
      (issue) => !issue.pull_request,
    );
  }

  async readCursor() {
    const found = [];
    for (const issue of await this.issues()) {
      const data = decode(issue, cursorMarker);
      if (data) {
        found.push({ issue, data });
      }
    }
    if (found.length > 1) {
      throw new Error('Multiple release cursors exist');
    }
    if (!found.length) {
      return null;
    }
    const { issue, data } = found[0];
    verifySha(data.baseline);
    verifySha(data.lastConsumed);
    if (data.repository !== this.repository || data.ref !== 'refs/heads/main') {
      throw new Error('Release cursor belongs to a different repository or ref');
    }
    if (data.latestPublishedVersion !== null) {
      parseVersion(data.latestPublishedVersion);
      if (data.latestPublishedTag !== data.latestPublishedVersion) {
        throw new Error('Release cursor contains inconsistent published version metadata');
      }
    } else if (data.latestPublishedTag !== null) {
      throw new Error('Release cursor contains an unexpected published tag');
    }
    if (
      data.lastReconciledAt !== null &&
      (typeof data.lastReconciledAt !== 'string' ||
        Number.isNaN(Date.parse(data.lastReconciledAt)) ||
        new Date(data.lastReconciledAt).toISOString() !== data.lastReconciledAt)
    ) {
      throw new Error('Release cursor contains an invalid reconciliation timestamp');
    }
    this.cursorIssue = issue.number;
    return {
      repository: data.repository,
      ref: data.ref,
      baseline: data.baseline,
      lastConsumed: data.lastConsumed,
      latestPublishedVersion: data.latestPublishedVersion,
      latestPublishedTag: data.latestPublishedTag,
      lastReconciledAt: data.lastReconciledAt,
    };
  }

  async initialize(sha) {
    verifySha(sha);
    if (await this.readCursor()) {
      throw new Error('Release cursor already exists');
    }
    if ((await this.readMainHead()) !== sha) {
      throw new Error('Baseline must equal the current main branch head');
    }
    const releases = await this.pages(`${this.root}/releases`);
    const published = releases.filter((release) => !release.draft && !release.prerelease);
    for (const release of published) {
      parseVersion(release.tag_name);
    }
    published.sort((a, b) => compareVersions(b.tag_name, a.tag_name));
    const latest = published[0]?.tag_name ?? null;
    await this.request(`${this.root}/issues`, {
      method: 'POST',
      body: {
        title: 'Release automation cursor',
        body: encoded(cursorMarker, {
          repository: this.repository,
          ref: 'refs/heads/main',
          baseline: sha,
          lastConsumed: sha,
          latestPublishedVersion: latest,
          latestPublishedTag: latest,
          lastReconciledAt: null,
        }),
      },
    });
  }

  async readMainHead() {
    const main = await this.request(`${this.root}/git/ref/heads/main`);
    return verifySha(main.object?.sha);
  }

  async listReceipts() {
    const result = [];
    for (const issue of await this.issues()) {
      const data = decode(issue, receiptMarker);
      if (!data) {
        continue;
      }
      verifySha(data.before, true);
      verifySha(data.after);
      if (
        data.repository !== this.repository ||
        data.ref !== 'refs/heads/main' ||
        !/^\d+$/.test(data.deliveryId ?? '')
      ) {
        throw new Error(`Invalid release receipt #${issue.number}`);
      }
      result.push({ ...data, issue: issue.number });
    }
    return result;
  }

  async capture(before, after) {
    verifySha(before, true);
    verifySha(after);
    if (!/^\d+$/.test(this.runId)) {
      throw new Error('A GitHub workflow run identity is required to capture a push');
    }
    const existing = await this.listReceipts();
    const delivery = existing.find((item) => item.deliveryId === this.runId);
    if (delivery && (delivery.before !== before || delivery.after !== after)) {
      throw new Error('A delivery identity is already associated with a different push');
    }
    const receipt = existing.find((item) => item.before === before && item.after === after);
    if (receipt) {
      await this.request(`${this.root}/issues/${receipt.issue}`, {
        method: 'PATCH',
        body: { state: 'closed' },
      });
      return;
    }
    const created = await this.request(`${this.root}/issues`, {
      method: 'POST',
      body: {
        title: `Release push ${after.slice(0, 12)}`,
        body: encoded(receiptMarker, {
          repository: this.repository,
          ref: 'refs/heads/main',
          before,
          after,
          deliveryId: this.runId,
          run: this.runUrl,
          status: 'captured',
          validation: null,
          bumpClassification: null,
          error: null,
        }),
      },
    });
    await this.request(`${this.root}/issues/${created.number}`, {
      method: 'PATCH',
      body: { state: 'closed' },
    });
  }

  async updateCursor(cursor) {
    if (!this.cursorIssue) {
      throw new Error('Cursor issue was not loaded');
    }
    verifySha(cursor.baseline);
    verifySha(cursor.lastConsumed);
    if (cursor.repository !== this.repository || cursor.ref !== 'refs/heads/main') {
      throw new Error('Cannot update a cursor for another repository or ref');
    }
    await this.request(`${this.root}/issues/${this.cursorIssue}`, {
      method: 'PATCH',
      body: { body: encoded(cursorMarker, cursor) },
    });
  }

  async updateReceipt(receipt, update) {
    const issue = await this.request(`${this.root}/issues/${receipt.issue}`);
    const current = decode(issue, receiptMarker);
    if (
      !current ||
      current.repository !== this.repository ||
      current.ref !== 'refs/heads/main' ||
      current.before !== receipt.before ||
      current.after !== receipt.after ||
      current.deliveryId !== receipt.deliveryId
    ) {
      throw new Error(`Release receipt #${receipt.issue} changed unexpectedly`);
    }
    const allowed = {
      status: update.status,
      validation: update.validation ?? null,
      bumpClassification: update.bumpClassification ?? null,
      error: update.error ?? null,
    };
    await this.request(`${this.root}/issues/${receipt.issue}`, {
      method: 'PATCH',
      body: { body: encoded(receiptMarker, { ...current, ...allowed }) },
    });
  }

  redact(value) {
    return String(value).replaceAll(this.token, '[redacted]').slice(0, 2000);
  }

  async isAncestor(before, after) {
    verifySha(before);
    verifySha(after);
    const comparison = await this.request(`${this.root}/compare/${before}...${after}`);
    return comparison.status === 'ahead' && comparison.merge_base_commit?.sha === before;
  }

  async fileAt(sha, name, optional = false) {
    verifySha(sha);
    const result = await this.request(`${this.root}/contents/${name}?ref=${sha}`, { optional });
    if (result === null && optional) {
      return null;
    }
    if (result.encoding !== 'base64' || typeof result.content !== 'string') {
      throw new Error(`Cannot read ${name} at ${sha}`);
    }
    return Buffer.from(result.content.replace(/\s/g, ''), 'base64');
  }

  async readMetadata(sha) {
    const names = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json'];
    const [pkg, lock, manifest, versions] = await Promise.all(
      names.map(async (name) => JSON.parse((await this.fileAt(sha, name)).toString('utf8'))),
    );
    return { pkg, lock, manifest, versions };
  }

  async validatedRun(sha) {
    verifySha(sha);
    const runs = await this.pages(
      `${this.root}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push`,
      'workflow_runs',
    );
    const run = selectValidationRun(runs, sha);
    if (!run) {
      return null;
    }
    const jobs = await this.pages(`${this.root}/actions/runs/${run.id}/jobs`, 'jobs');
    const checks = requireSuccessfulChecks(run, jobs);
    const coverage = JSON.parse(
      (await this.readArtifact(run, `coverage-${sha}`, ['coverage-summary.json']))[
        'coverage-summary.json'
      ].toString('utf8'),
    ).total;
    const lines = coverage?.lines?.pct;
    const branches = coverage?.branches?.pct;
    if (
      ![lines, branches].every(
        (value) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
      )
    ) {
      throw new Error(`CI run ${run.id} has an invalid coverage summary`);
    }
    const manifest = JSON.parse((await this.fileAt(sha, 'manifest.json')).toString('utf8'));
    const rawException = await this.fileAt(sha, '.github/coverage-exception.json', true);
    const exception = rawException ? JSON.parse(rawException.toString('utf8')) : null;
    const thresholds = coverageThresholds(
      exception,
      manifest.version,
      new Date().toISOString().slice(0, 10),
      this.repository,
    );
    if (lines < thresholds.lines || branches < thresholds.branches) {
      throw new Error(`CI run ${run.id} is below the applicable coverage thresholds`);
    }
    return {
      ...run,
      checks,
      coverage: { lines, branches, thresholds, exception },
    };
  }

  async readArtifact(run, name, names) {
    const uploaded = await this.pages(`${this.root}/actions/runs/${run.id}/artifacts`, 'artifacts');
    const matches = uploaded.filter((artifact) => artifact.name === name && !artifact.expired);
    if (matches.length !== 1) {
      throw new Error(`Validated artifact ${name} is missing or ambiguous`);
    }
    const archive = await this.request(`${this.root}/actions/artifacts/${matches[0].id}/zip`, {
      accept: 'application/octet-stream',
    });
    return extractArtifact(archive, names);
  }

  async readBuild(run, sha) {
    const build = await this.readArtifact(run, `plugin-${sha}`, assets);
    if (!build['manifest.json'].equals(await this.fileAt(sha, 'manifest.json'))) {
      throw new Error('Build manifest differs from committed manifest');
    }
    return build;
  }

  async resolveTagCommit(ref) {
    let object = ref?.object;
    const visited = new Set();
    while (object?.type === 'tag') {
      verifySha(object.sha);
      if (visited.has(object.sha) || visited.size >= 8) {
        throw new Error('Annotated tag chain is cyclic or too deep');
      }
      visited.add(object.sha);
      object = (await this.request(`${this.root}/git/tags/${object.sha}`)).object;
    }
    if (object?.type !== 'commit') {
      throw new Error('Release tag does not resolve to a commit');
    }
    return verifySha(object.sha);
  }

  async publishRelease({ version, sha, validation, build, receipt }) {
    parseVersion(version);
    verifySha(sha);
    const releases = await this.pages(`${this.root}/releases`);
    const matches = releases.filter((release) => release.tag_name === version);
    if (matches.length > 1) {
      throw new Error(`Multiple releases for ${version}`);
    }
    for (const release of releases) {
      if (release.draft || release.prerelease || release.tag_name === version) {
        continue;
      }
      try {
        parseVersion(release.tag_name);
      } catch {
        throw new Error(
          `Published tag ${release.tag_name} is not a stable x.y.z version; cannot verify release order`,
        );
      }
      if (compareVersions(release.tag_name, version) >= 0) {
        throw new Error(`Published version ${release.tag_name} is not older than ${version}`);
      }
    }
    const marker = `<!-- habit-rhythm-release:${version}:${sha} -->`;
    let release = matches[0];
    if (release && !release.body?.includes(marker)) {
      throw new Error(`Release ${version} is not owned by this source revision`);
    }
    let ref = await this.request(`${this.root}/git/ref/tags/${version}`, { optional: true });
    if (ref && (await this.resolveTagCommit(ref)) !== sha) {
      throw new Error(`Tag ${version} points to another source`);
    }
    if (!ref) {
      await this.request(`${this.root}/git/refs`, {
        method: 'POST',
        body: { ref: `refs/tags/${version}`, sha },
      });
      ref = await this.request(`${this.root}/git/ref/tags/${version}`);
      if ((await this.resolveTagCommit(ref)) !== sha) {
        throw new Error(`Could not verify tag ${version}`);
      }
    }
    if (!release) {
      const assetDigests = assets
        .map((name) => `${name}: sha256:${createHash('sha256').update(build[name]).digest('hex')}`)
        .join('\n');
      const receiptUrl = receipt?.issue
        ? `${this.serverUrl}/${this.repository}/issues/${receipt.issue}`
        : 'Unavailable';
      release = await this.request(`${this.root}/releases`, {
        method: 'POST',
        body: {
          tag_name: version,
          target_commitish: sha,
          name: version,
          draft: true,
          prerelease: false,
          body: `${marker}\nValidated source: ${sha}\nPush receipt: ${receiptUrl}\nValidation: ${validation.html_url}\nBuild: CI artifact from ${sha}\n${assetDigests}\n`,
        },
      });
    }
    const currentAssets = await this.pages(`${this.root}/releases/${release.id}/assets`);
    if (currentAssets.some((asset) => !assets.includes(asset.name))) {
      throw new Error(`Unexpected asset on release ${version}`);
    }
    for (const name of assets) {
      let candidates = currentAssets.filter((asset) => asset.name === name);
      if (candidates.length > 1) {
        throw new Error(`Duplicate asset ${name}`);
      }
      if (!candidates.length) {
        if (!release.draft) {
          throw new Error(`Published release ${version} is missing ${name}`);
        }
        const uploadUrl = release.upload_url?.replace(/\{.*$/, '');
        if (!uploadUrl) {
          throw new Error('Release upload URL is missing');
        }
        const uploaded = await this.request(`${uploadUrl}?name=${encodeURIComponent(name)}`, {
          method: 'POST',
          body: build[name],
          binary: true,
        });
        candidates = [uploaded];
      }
      const downloaded = await this.request(`${this.root}/releases/assets/${candidates[0].id}`, {
        accept: 'application/octet-stream',
      });
      if (!downloaded.equals(build[name])) {
        throw new Error(`Release asset ${name} differs from validated build`);
      }
    }
    if (release.draft) {
      release = await this.request(`${this.root}/releases/${release.id}`, {
        method: 'PATCH',
        body: { draft: false, make_latest: 'true' },
      });
      if (release.draft) {
        throw new Error(`Release ${version} is still a draft`);
      }
    }
  }
}
