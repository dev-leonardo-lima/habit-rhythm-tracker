import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));

function actionSteps(workflow) {
  return Object.values(workflow.jobs).flatMap((job) => job.steps.filter((step) => step.uses));
}

describe('GitHub Actions safety contract', () => {
  it('runs read-only CI on pull requests, main, and manual dispatch with all required gates', () => {
    expect(ci.on).toHaveProperty('pull_request');
    expect(ci.on.push.branches).toEqual(['main']);
    expect(ci.on).toHaveProperty('workflow_dispatch');
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

  it('uses versioned actions and keeps the release job on reviewed main with minimal permissions', () => {
    for (const step of actionSteps(ci)) {
      expect(step.uses).toMatch(/^[\w.-]+\/[\w.-]+@v\d+(?:\.\d+){0,2}$/);
      if (step.uses.startsWith('actions/checkout@')) {
        expect(step.with['persist-credentials']).toBe(false);
      }
    }
    const release = ci.jobs.release;
    expect(release.needs).toBe('validate');
    expect(release.if).toContain('refs/heads/main');
    expect(release.if).toContain("github.event_name == 'push'");
    expect(release.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(release.permissions).toEqual({
      contents: 'write',
      actions: 'read',
      'id-token': 'write',
      attestations: 'write',
    });
    expect(release.concurrency).toEqual({
      group: 'habit-rhythm-tracker-release',
      'cancel-in-progress': false,
    });
    expect(release.steps.some((step) => /npm (ci|install)/.test(step.run ?? ''))).toBe(false);
    expect(JSON.stringify(ci)).not.toContain('issues:');
    expect(JSON.stringify(ci)).not.toContain('pull_request_target');
  });

  it('stores the plugin and coverage artifacts only for main', () => {
    const artifacts = ci.jobs.validate.steps.filter((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    );
    expect(artifacts).toHaveLength(2);
    expect(artifacts.every((step) => step.if.includes('refs/heads/main'))).toBe(true);
    expect(
      artifacts[0].with.path
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ).toEqual(['main.js', 'manifest.json', 'styles.css']);
    expect(artifacts[1].with.path).toBe('coverage/coverage-summary.json');
  });

  it('releases from the validated artifact with draft-first, idempotent publication', () => {
    const release = ci.jobs.release;
    const download = release.steps.find((step) =>
      step.uses?.startsWith('actions/download-artifact@'),
    );
    expect(download.with).toEqual({
      name: 'plugin-${{ github.sha }}',
      path: 'release',
    });
    const attest = release.steps.find((step) => step.uses?.startsWith('actions/attest@'));
    expect(attest.with['subject-path'].trim().split('\n')).toEqual([
      'release/main.js',
      'release/manifest.json',
      'release/styles.css',
    ]);
    expect(release.steps.indexOf(download)).toBeLessThan(release.steps.indexOf(attest));
    const publish = release.steps.find((step) => step.name?.includes('Publish release'));
    expect(release.steps.indexOf(attest)).toBeLessThan(release.steps.indexOf(publish));
    const script = publish.run;
    for (const command of [
      'gh release view',
      'gh release create',
      '--draft',
      'gh release upload',
      'verify_assets',
      'gh release edit',
      '--draft=false',
      '--latest',
    ]) {
      expect(script).toContain(command);
    }
    expect(script).toContain('is not greater than the latest published version');
    expect(script).toContain('Tag $version points to');
  });

  it('removes the previous event ledger and its tooling', () => {
    expect(existsSync('.github/workflows/release.yml')).toBe(false);
    for (const file of [
      'scripts/release-cli.mjs',
      'scripts/release-engine.mjs',
      'scripts/release-engine.d.mts',
      'scripts/github-release-api.mjs',
      'scripts/validation-gate.mjs',
    ]) {
      expect(existsSync(file)).toBe(false);
    }
  });
});
