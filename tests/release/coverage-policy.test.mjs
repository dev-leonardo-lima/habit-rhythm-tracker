import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverageThresholds, loadCoverageThresholds } from '../../scripts/coverage-policy.mjs';

function exception() {
  return {
    version: '1.0.0',
    scope: 'Application branch coverage for 1.0.0',
    reason: 'Device-specific integration cannot yet be reproduced in CI',
    risk: 'Some device integration paths remain untested',
    remediation: 'Add integration fixtures in the next minor release',
    approvedBy: 'maintainer',
    approvalUrl: 'https://github.com/owner/project/pull/12#pullrequestreview-34',
    expiresOn: '2026-12-31',
    thresholds: { lines: 80, branches: 75 },
  };
}

describe('coverage exception policy', () => {
  it('enforces the normal thresholds without an exception', () => {
    expect(coverageThresholds(null, '1.0.0', '2026-10-29')).toEqual({ lines: 80, branches: 80 });
  });

  it('permits only the recorded temporary thresholds for the same version', () => {
    expect(coverageThresholds(exception(), '1.0.0', '2026-10-29')).toEqual({
      lines: 80,
      branches: 75,
    });
    const approvalUrl = 'https://github.com/owner/project/pull/12#issuecomment-34';
    expect(coverageThresholds({ ...exception(), approvalUrl }, '1.0.0', '2026-10-29')).toEqual({
      lines: 80,
      branches: 75,
    });
    expect(() => coverageThresholds(exception(), '1.0.1', '2026-10-29')).toThrow(
      'current plugin version',
    );
    expect(() => coverageThresholds(exception(), '1.0.0', '2027-01-01')).toThrow('expired');
  });

  it.each(['scope', 'reason', 'risk', 'remediation', 'approvedBy', 'approvalUrl'])(
    'rejects missing %s',
    (field) => {
      expect(() =>
        coverageThresholds({ ...exception(), [field]: '' }, '1.0.0', '2026-10-29'),
      ).toThrow(field);
    },
  );

  it('rejects malformed dates, generic approval links, and out-of-range thresholds', () => {
    const record = exception();
    expect(() =>
      coverageThresholds({ ...record, expiresOn: '2026-02-30' }, '1.0.0', '2026-01-01'),
    ).toThrow('invalid expiry');
    expect(() =>
      coverageThresholds(
        { ...record, approvalUrl: 'https://github.com/owner/project/pull/12' },
        '1.0.0',
        '2026-10-29',
      ),
    ).toThrow('specific GitHub');
    expect(() => coverageThresholds(record, '1.0.0', '2026-10-29', 'other/project')).toThrow(
      'this repository',
    );
    expect(() =>
      coverageThresholds(
        { ...record, thresholds: { lines: 80, branches: -1 } },
        '1.0.0',
        '2026-10-29',
      ),
    ).toThrow('Invalid branches');
    expect(() =>
      coverageThresholds(
        { ...record, thresholds: { lines: 80, branches: 80 } },
        '1.0.0',
        '2026-10-29',
      ),
    ).toThrow('does not lower');
  });

  it('reads the manifest and exception together and fails on malformed records', () => {
    const root = mkdtempSync(join(tmpdir(), 'habit-coverage-policy-'));
    try {
      mkdirSync(join(root, '.github'));
      writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version: '1.0.0' }));
      expect(loadCoverageThresholds(root, '2026-10-29', 'owner/project')).toEqual({
        lines: 80,
        branches: 80,
      });
      writeFileSync(join(root, '.github', 'coverage-exception.json'), JSON.stringify(exception()));
      expect(loadCoverageThresholds(root, '2026-10-29', 'owner/project')).toEqual({
        lines: 80,
        branches: 75,
      });
      writeFileSync(join(root, '.github', 'coverage-exception.json'), '{invalid');
      expect(() => loadCoverageThresholds(root, '2026-10-29', 'owner/project')).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
