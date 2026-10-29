import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('scripts/validate-versions.mjs');
const directories: string[] = [];

function metadata(directory: string, version: string): void {
  const values: Record<string, unknown> = {
    'package.json': { name: 'example', version },
    'package-lock.json': {
      name: 'example',
      version,
      packages: { '': { name: 'example', version } },
    },
    'manifest.json': { version, minAppVersion: '1.6.0' },
    'versions.json': { [version]: '1.6.0' },
  };
  for (const [name, value] of Object.entries(values)) {
    writeFileSync(join(directory, name), `${JSON.stringify(value)}\n`);
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('version validation against the push base', () => {
  it('accepts unchanged and increased versions and refuses decreases or mismatches', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'habit-version-check-'));
    directories.push(cwd);
    metadata(cwd, '1.2.3');
    execFileSync('git', ['init', '-q'], { cwd });
    execFileSync('git', ['add', '.'], { cwd });
    execFileSync(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'],
      { cwd },
    );
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    const run = () =>
      execFileSync(process.execPath, [script], {
        cwd,
        env: { ...process.env, BASE_SHA: base },
        stdio: 'pipe',
      });
    expect(() => run()).not.toThrow();
    metadata(cwd, '1.2.4');
    expect(() => run()).not.toThrow();
    metadata(cwd, '1.2.2');
    expect(() => run()).toThrow();
    metadata(cwd, '1.2.4');
    writeFileSync(join(cwd, 'manifest.json'), '{"version":"1.2.3","minAppVersion":"1.6.0"}');
    expect(() => run()).toThrow();
    metadata(cwd, '1.2.4');
    writeFileSync(join(cwd, 'versions.json'), '{}');
    expect(() => run()).toThrow();
    metadata(cwd, '1.2.4');
    rmSync(join(cwd, 'package-lock.json'));
    expect(() => run()).toThrow();
    for (const invalidVersion of ['01.2.4', '1.2.4-beta', '9007199254740992.0.0']) {
      metadata(cwd, invalidVersion);
      expect(() => run()).toThrow();
    }
    metadata(cwd, '1.2.4');
    writeFileSync(
      join(cwd, 'package-lock.json'),
      JSON.stringify({
        name: 'other',
        version: '1.2.4',
        packages: { '': { name: 'other', version: '1.2.4' } },
      }),
    );
    expect(() => run()).toThrow();
  });
});
