import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const release = parse(readFileSync('.github/workflows/release.yml', 'utf8'));

function actionSteps(workflow) {
  return Object.values(workflow.jobs).flatMap((job) => job.steps.filter((step) => step.uses));
}

describe('GitHub Actions safety contract', () => {
  it('runs read-only CI on pull requests and main with all required gates', () => {
    expect(ci.on).toHaveProperty('pull_request');
    expect(ci.on.push.branches).toEqual(['main']);
    expect(ci.on).not.toHaveProperty('pull_request_target');
    expect(ci.permissions).toEqual({ contents: 'read' });
    const commands = ci.jobs.validate.steps.map((step) => step.run).filter(Boolean);
    for (const command of [
      'npm ci',
      'npm run version:check',
      'npm run typecheck',
      'npm run lint',
      'npm run format:check',
      'npm run test:coverage',
      'npm run build',
    ]) {
      expect(commands).toContain(command);
    }
  });

  it('pins actions and keeps privileged jobs on reviewed main with minimal permissions', () => {
    for (const step of [...actionSteps(ci), ...actionSteps(release)]) {
      expect(step.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      if (step.uses.startsWith('actions/checkout@')) {
        expect(step.with['persist-credentials']).toBe(false);
      }
    }
    expect(release.on).not.toHaveProperty('pull_request_target');
    expect(release.permissions).toEqual({});
    expect(release.jobs.intake.permissions).toEqual({ contents: 'read', issues: 'write' });
    expect(release.jobs.reconcile.permissions).toEqual({
      actions: 'read',
      contents: 'write',
      issues: 'write',
    });
    for (const job of Object.values(release.jobs)) {
      const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
      expect(checkout.with.ref).toBe('main');
      expect(job.steps.some((step) => /npm (ci|install)/.test(step.run ?? ''))).toBe(false);
    }
  });

  it('stores the plugin and coverage artifacts only for a main push', () => {
    const artifacts = ci.jobs.validate.steps.filter((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    );
    expect(artifacts).toHaveLength(2);
    expect(
      artifacts.every(
        (step) =>
          step.if.includes("github.event_name == 'push'") && step.if.includes('refs/heads/main'),
      ),
    ).toBe(true);
    expect(
      artifacts[0].with.path
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ).toEqual(['main.js', 'manifest.json', 'styles.css']);
    expect(artifacts[1].with.path).toBe('coverage/coverage-summary.json');
  });

  it('reconciles on intake, completed main CI, a schedule, and manual retry', () => {
    expect(release.on.push.branches).toEqual(['main']);
    expect(release.on.workflow_run.workflows).toEqual(['CI']);
    expect(release.on.workflow_run.types).toEqual(['completed']);
    expect(release.on.schedule.length).toBeGreaterThan(0);
    expect(release.on).toHaveProperty('workflow_dispatch');
    expect(release.jobs.reconcile.needs).toBe('intake');
    expect(release.jobs.reconcile.concurrency['cancel-in-progress']).toBe(false);
    expect(release.jobs.reconcile.if).toContain("github.event.workflow_run.event == 'push'");
  });
});
