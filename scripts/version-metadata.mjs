import { readFileSync } from 'node:fs';

const files = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json'];

export function parseVersion(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Invalid stable version: ${String(version)}`);
  }
  const parts = version.split('.').map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error('Version component is too large');
  }
  return parts;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] < right[i] ? -1 : 1;
    }
  }
  return 0;
}

export function validateMetadata({ pkg, lock, manifest, versions }) {
  const version = pkg.version;
  parseVersion(version);
  parseVersion(manifest.minAppVersion);
  if (
    lock.version !== version ||
    lock.packages?.['']?.version !== version ||
    manifest.version !== version
  ) {
    throw new Error('package.json, package-lock.json, and manifest.json versions must match');
  }
  if (lock.name !== pkg.name || lock.packages?.['']?.name !== pkg.name) {
    throw new Error('Package and lockfile names must match');
  }
  if (
    !versions ||
    Array.isArray(versions) ||
    typeof versions !== 'object' ||
    versions[version] !== manifest.minAppVersion
  ) {
    throw new Error('versions.json must map the current version to manifest.minAppVersion');
  }
  for (const [key, value] of Object.entries(versions)) {
    parseVersion(key);
    parseVersion(value);
  }
  return version;
}

export function readMetadata(read = (file) => readFileSync(file, 'utf8')) {
  const [pkg, lock, manifest, versions] = files.map((file) => JSON.parse(read(file)));
  return { pkg, lock, manifest, versions };
}

export function nextVersion(current, choice) {
  const parts = parseVersion(current);
  const position = ['major', 'minor', 'patch'].indexOf(choice);
  if (position < 0) {
    throw new Error('Choose patch, minor, or major');
  }
  parts[position] += 1;
  for (let i = position + 1; i < 3; i += 1) {
    parts[i] = 0;
  }
  const result = parts.join('.');
  parseVersion(result);
  return result;
}
