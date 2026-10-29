import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('scripts/version-bump.mjs');
const files = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json'];
const directories: string[] = [];

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'habit-version-test-'));
  directories.push(directory);
  const values = [
    { name: 'example', version: '1.2.3' },
    { name: 'example', version: '1.2.3', packages: { '': { name: 'example', version: '1.2.3' } } },
    { version: '1.2.3', minAppVersion: '1.6.0' },
    { '1.2.3': '1.6.0' },
  ];
  files.forEach((file, index) =>
    writeFileSync(join(directory, file), `${JSON.stringify(values[index], null, 2)}\n`),
  );
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('explicit version command', () => {
  it.each([
    ['patch', '1.2.4'],
    ['minor', '1.3.0'],
    ['major', '2.0.0'],
  ])('synchronizes %s metadata without creating a tag', (choice, version) => {
    const cwd = fixture();
    execFileSync(process.execPath, [script, choice], { cwd });
    const [pkg, lock, manifest, versions] = files.map((file) =>
      JSON.parse(readFileSync(join(cwd, file), 'utf8')),
    );
    expect([pkg.version, lock.version, lock.packages[''].version, manifest.version]).toEqual(
      Array(4).fill(version),
    );
    expect(versions).toEqual({ '1.2.3': '1.6.0', [version]: '1.6.0' });
  });

  it.each(['constructor', 'beta', ''])(
    'rejects invalid choice %s without changing files',
    (choice) => {
      const cwd = fixture();
      const before = files.map((file) => readFileSync(join(cwd, file), 'utf8'));
      expect(() =>
        execFileSync(process.execPath, [script, choice], { cwd, stdio: 'pipe' }),
      ).toThrow();
      expect(files.map((file) => readFileSync(join(cwd, file), 'utf8'))).toEqual(before);
    },
  );

  it('rejects inconsistent metadata before modifying any file', () => {
    const cwd = fixture();
    writeFileSync(join(cwd, 'manifest.json'), '{"version":"1.2.0","minAppVersion":"1.6.0"}');
    const before = files.map((file) => readFileSync(join(cwd, file), 'utf8'));
    expect(() =>
      execFileSync(process.execPath, [script, 'patch'], { cwd, stdio: 'pipe' }),
    ).toThrow();
    expect(files.map((file) => readFileSync(join(cwd, file), 'utf8'))).toEqual(before);
  });

  it('rejects a version already present in compatibility history', () => {
    const cwd = fixture();
    writeFileSync(join(cwd, 'versions.json'), '{"1.2.3":"1.6.0","1.2.4":"1.6.0"}');
    expect(() =>
      execFileSync(process.execPath, [script, 'patch'], { cwd, stdio: 'pipe' }),
    ).toThrow();
  });

  it('does not commit or create tags in a Git repository', () => {
    const cwd = fixture();
    execFileSync('git', ['init', '-q'], { cwd });
    execFileSync('git', ['add', '.'], { cwd });
    execFileSync(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'],
      { cwd },
    );
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
    execFileSync(process.execPath, [script, 'patch'], { cwd });
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' })).toBe(head);
    expect(execFileSync('git', ['tag', '--list'], { cwd, encoding: 'utf8' })).toBe('');
    expect(
      execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim().split('\n'),
    ).toHaveLength(4);
  });

  it('restores earlier files when a staged update fails partway through', () => {
    const cwd = fixture();
    const before = files.map((file) => readFileSync(join(cwd, file), 'utf8'));
    const preload = join(cwd, 'fail-rename.mjs');
    writeFileSync(
      preload,
      [
        "import fs from 'node:fs';",
        "import { syncBuiltinESMExports } from 'node:module';",
        'const original = fs.renameSync; let calls = 0;',
        "fs.renameSync = (...args) => { if (++calls === 3) throw new Error('simulated rename failure'); return original(...args); };",
        'syncBuiltinESMExports();',
      ].join('\n'),
    );
    expect(() =>
      execFileSync(process.execPath, ['--import', preload, script, 'patch'], {
        cwd,
        stdio: 'pipe',
      }),
    ).toThrow();
    expect(files.map((file) => readFileSync(join(cwd, file), 'utf8'))).toEqual(before);
  });
});
