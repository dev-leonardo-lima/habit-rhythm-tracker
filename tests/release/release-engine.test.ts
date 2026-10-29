import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcileReleases } from '../../scripts/release-engine.mjs';

function metadata(version: string) {
  return {
    pkg: { name: 'example', version },
    lock: { name: 'example', version, packages: { '': { name: 'example', version } } },
    manifest: { version, minAppVersion: '1.6.0' },
    versions: { [version]: '1.6.0' },
  };
}

function fake() {
  const api = {
    cursor: { lastConsumed: 'a', baseline: 'a' },
    receipts: [
      { before: 'b', after: 'c' },
      { before: 'a', after: 'b' },
    ],
    versions: { a: '1.0.0', b: '1.0.1', c: '1.0.1' } as Record<string, string>,
    available: new Set(['b', 'c']),
    releases: [] as string[],
    ancestor: true,
    failAfterPublishing: false,
    updates: [] as Array<{ status: string; error?: string | null }>,
    async readCursor() {
      return api.cursor;
    },
    async readMainHead() {
      return api.cursor.lastConsumed;
    },
    async listReceipts() {
      return api.receipts;
    },
    async isAncestor(_before: string, _after: string) {
      return api.ancestor;
    },
    async validatedRun(sha: string) {
      return api.available.has(sha) ? { sha } : null;
    },
    async readMetadata(sha: string) {
      return metadata(api.versions[sha] ?? '');
    },
    async readBuild() {
      return {};
    },
    async publishRelease({ version, sha }: { version: string; sha: string }) {
      const identity = `${version}:${sha}`;
      if (!api.releases.includes(identity)) {
        api.releases.push(identity);
      }
      if (api.failAfterPublishing) {
        throw new Error('worker interrupted');
      }
    },
    async updateCursor(cursor: { lastConsumed: string; baseline: string }) {
      api.cursor = cursor;
    },
    async updateReceipt(_receipt: unknown, update: { status: string; error?: string | null }) {
      api.updates.push(update);
    },
    redact(value: string) {
      return value;
    },
  };
  return api;
}

describe('ordered release reconciliation', () => {
  it('processes out-of-order and duplicate receipts in push order, releasing only a bump', async () => {
    const api = fake();
    api.receipts.push({ before: 'a', after: 'b' });
    const result = await reconcileReleases(api);
    expect(result.processed.map((entry: { after: string }) => entry.after)).toEqual(['b', 'c']);
    expect(api.releases).toEqual(['1.0.1:b']);
    expect(api.cursor.lastConsumed).toBe('c');
    expect(api.cursor).toMatchObject({
      latestPublishedVersion: '1.0.1',
      latestPublishedTag: '1.0.1',
    });
    expect(api.updates.map((update) => update.status)).toEqual([
      'validated',
      'validated',
      'published',
      'published',
      'validated',
      'validation-only-complete',
    ]);
  });

  it('waits for validation and never skips a blocked predecessor', async () => {
    const api = fake();
    api.available.delete('b');
    const result = await reconcileReleases(api);
    expect(result.waitingFor).toBe('validation:b');
    expect(api.cursor.lastConsumed).toBe('a');
    expect(api.releases).toEqual([]);
  });

  it('classifies a multi-commit push once using its final tip', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'habit-push-history-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd });
      const commit = (content: string) => {
        writeFileSync(join(cwd, 'fixture.txt'), content);
        execFileSync('git', ['add', 'fixture.txt'], { cwd });
        execFileSync(
          'git',
          [
            '-c',
            'user.name=Test',
            '-c',
            'user.email=test@example.invalid',
            'commit',
            '-qm',
            content,
          ],
          { cwd },
        );
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
      };
      const before = commit('baseline');
      const intermediate = commit('first change');
      const after = commit('second change');
      const api = fake();
      api.cursor = { baseline: before, lastConsumed: before };
      api.receipts = [{ before, after }];
      api.versions = { [before]: '1.0.0', [intermediate]: '1.0.1', [after]: '1.1.0' };
      api.available = new Set([after]);
      api.isAncestor = async (base: string, tip: string) => {
        try {
          execFileSync('git', ['merge-base', '--is-ancestor', base, tip], { cwd });
          return true;
        } catch {
          return false;
        }
      };
      const result = await reconcileReleases(api);
      expect(result.processed).toEqual([{ before, after, version: '1.1.0', released: true }]);
      expect(api.releases).toEqual([`1.1.0:${after}`]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('blocks publication and records the reason when validation fails', async () => {
    const api = fake();
    api.validatedRun = async () => {
      throw new Error('CI validation failed');
    };
    await expect(reconcileReleases(api)).rejects.toThrow('CI validation failed');
    expect(api.cursor.lastConsumed).toBe('a');
    expect(api.releases).toEqual([]);
    expect(api.updates[api.updates.length - 1]).toMatchObject({
      status: 'blocked',
      error: 'CI validation failed',
    });
  });

  it('distinguishes an idle queue from a missing next receipt', async () => {
    const idle = fake();
    idle.receipts = [];
    expect((await reconcileReleases(idle)).waitingFor).toBe('idle');
    expect(idle.cursor.lastConsumed).toBe('a');
    const missing = fake();
    missing.receipts = [{ before: 'b', after: 'c' }];
    missing.readMainHead = async () => 'c';
    expect((await reconcileReleases(missing)).waitingFor).toBe('receipt:a→c');
    expect(missing.cursor.lastConsumed).toBe('a');
    expect(missing.releases).toEqual([]);
  });

  it('retries a crash after publication without publishing a duplicate', async () => {
    const api = fake();
    api.failAfterPublishing = true;
    await expect(reconcileReleases(api)).rejects.toThrow('worker interrupted');
    expect(api.cursor.lastConsumed).toBe('a');
    api.failAfterPublishing = false;
    await reconcileReleases(api);
    expect(api.releases).toEqual(['1.0.1:b']);
    expect(api.cursor.lastConsumed).toBe('c');
  });

  it('preserves the published receipt if the cursor write succeeds but its response is lost', async () => {
    const api = fake();
    api.receipts = [{ before: 'a', after: 'b' }];
    api.updateCursor = async (cursor) => {
      api.cursor = cursor;
      throw new Error('cursor response lost');
    };
    await expect(reconcileReleases(api)).rejects.toThrow('retry cursor reconciliation');
    expect(api.cursor.lastConsumed).toBe('b');
    expect(api.updates[api.updates.length - 1]?.status).toBe('published');
    api.updateCursor = async (cursor) => {
      api.cursor = cursor;
    };
    expect((await reconcileReleases(api)).waitingFor).toBe('idle');
    expect(api.releases).toEqual(['1.0.1:b']);
  });

  it('halts on ambiguous, non-linear, or decreasing pushes without advancing', async () => {
    const ambiguous = fake();
    ambiguous.receipts.push({ before: 'a', after: 'other' });
    await expect(reconcileReleases(ambiguous)).rejects.toThrow('Ambiguous');
    expect(ambiguous.cursor.lastConsumed).toBe('a');
    expect(ambiguous.updates).toHaveLength(2);
    expect(ambiguous.updates.every((update) => update.status === 'blocked')).toBe(true);
    const rewritten = fake();
    rewritten.ancestor = false;
    await expect(reconcileReleases(rewritten)).rejects.toThrow('Non-linear');
    expect(rewritten.cursor.lastConsumed).toBe('a');
    const decreasing = fake();
    decreasing.versions.b = '0.9.0';
    await expect(reconcileReleases(decreasing)).rejects.toThrow('older');
    expect(decreasing.cursor.lastConsumed).toBe('a');
    expect(decreasing.updates[decreasing.updates.length - 1]).toMatchObject({
      status: 'blocked',
      error: expect.stringContaining('older'),
    });
  });

  it('halts before a release when a build is unavailable', async () => {
    const api = fake();
    api.readBuild = async () => {
      throw new Error('artifact missing');
    };
    await expect(reconcileReleases(api)).rejects.toThrow('artifact missing');
    expect(api.releases).toEqual([]);
    expect(api.cursor.lastConsumed).toBe('a');
  });

  it('does not advance when the ledger or main head is unavailable', async () => {
    const ledger = fake();
    ledger.listReceipts = async () => {
      throw new Error('ledger unavailable');
    };
    await expect(reconcileReleases(ledger)).rejects.toThrow('ledger unavailable');
    expect(ledger.cursor.lastConsumed).toBe('a');
    const head = fake();
    head.receipts = [];
    head.readMainHead = async () => {
      throw new Error('main unavailable');
    };
    await expect(reconcileReleases(head)).rejects.toThrow('main unavailable');
    expect(head.cursor.lastConsumed).toBe('a');
  });
});
