import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  nextVersion,
  parseVersion,
  readMetadata,
  validateMetadata,
} from '../../scripts/version-metadata.mjs';

function metadata() {
  return {
    pkg: { name: 'example', version: '1.2.3' },
    lock: {
      name: 'example',
      version: '1.2.3',
      packages: { '': { name: 'example', version: '1.2.3' } },
    },
    manifest: { version: '1.2.3', minAppVersion: '1.6.0' },
    versions: { '1.2.3': '1.6.0' },
  };
}

describe('release metadata rules', () => {
  it('compares stable versions numerically and increments only the selected component', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.2', '1.2.3')).toBe(-1);
    expect(nextVersion('1.2.3', 'major')).toBe('2.0.0');
    expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(nextVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it.each(['01.2.3', '1.2', '1.2.3-beta', '9007199254740992.0.0'])(
    'rejects invalid stable version %s',
    (value) => {
      expect(() => parseVersion(value)).toThrow();
    },
  );

  it('rejects mismatched metadata and invalid compatibility entries', () => {
    const record = metadata();
    expect(validateMetadata(record)).toBe('1.2.3');
    expect(() =>
      validateMetadata({ ...record, manifest: { ...record.manifest, version: '1.2.4' } }),
    ).toThrow('versions must match');
    expect(() => validateMetadata({ ...record, lock: { ...record.lock, name: 'other' } })).toThrow(
      'names must match',
    );
    expect(() => validateMetadata({ ...record, versions: { '1.2.3': '1.7.0' } })).toThrow(
      'must map',
    );
    expect(() =>
      validateMetadata({ ...record, versions: { '1.2.3': '1.6.0', bad: '1.6.0' } }),
    ).toThrow('Invalid stable version');
  });

  it('reads the complete metadata set through its supplied source', () => {
    const record = metadata();
    const files = {
      'package.json': record.pkg,
      'package-lock.json': record.lock,
      'manifest.json': record.manifest,
      'versions.json': record.versions,
    };
    expect(readMetadata((file) => JSON.stringify(files[file]))).toEqual(record);
  });
});
