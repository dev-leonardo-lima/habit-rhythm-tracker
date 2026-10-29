import { describe, expect, it, vi } from 'vitest';
import {
  REQUIRED_CHECKS,
  requireSuccessfulChecks,
  selectValidationRun,
} from '../../scripts/validation-gate.mjs';

function run(overrides = {}) {
  return {
    id: 1,
    head_sha: 'abc',
    head_branch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://example.invalid/ci',
    ...overrides,
  };
}

function jobs(overrides = {}) {
  return [
    {
      name: 'validate',
      conclusion: 'success',
      steps: REQUIRED_CHECKS.map((name) => ({ name, conclusion: 'success' })),
      ...overrides,
    },
  ];
}

describe('independent validation gate', () => {
  it('accepts a successful main run only after all required checks pass', () => {
    const selected = selectValidationRun([run()], 'abc');
    expect(requireSuccessfulChecks(selected, jobs())).toEqual(
      Object.fromEntries(REQUIRED_CHECKS.map((name) => [name, 'success'])),
    );
  });

  it('does not make a failing, pending, PR, or different-SHA run eligible for publication', () => {
    const publish = vi.fn();
    const attempt = (candidate, candidateJobs = jobs()) => {
      const selected = selectValidationRun([candidate], 'abc');
      if (selected) {
        requireSuccessfulChecks(selected, candidateJobs);
        publish();
      }
    };
    expect(() => attempt(run({ conclusion: 'failure' }))).toThrow('CI validation failed');
    attempt(run({ status: 'in_progress' }));
    attempt(run({ event: 'pull_request' }));
    attempt(run({ head_sha: 'other' }));
    expect(() => attempt(run(), jobs({ steps: [] }))).toThrow('required check');
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not reuse an older passing run when the newest run for the same SHA failed', () => {
    const older = run({ id: 1, created_at: '2026-10-28T00:00:00Z' });
    const newer = run({ id: 2, created_at: '2026-10-29T00:00:00Z', conclusion: 'failure' });
    expect(() => selectValidationRun([older, newer], 'abc')).toThrow('CI validation failed');
  });
});
