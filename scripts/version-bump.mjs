import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { nextVersion, readMetadata, validateMetadata } from './version-metadata.mjs';

const paths = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json'];
const originals = new Map();
const staged = [];
const replaced = [];

try {
  if (process.argv.length !== 3) {
    throw new Error('Usage: npm run version:bump -- patch|minor|major');
  }
  for (const path of paths) {
    originals.set(path, readFileSync(path, 'utf8'));
  }
  const metadata = readMetadata((path) => originals.get(path));
  const current = validateMetadata(metadata);
  const version = nextVersion(current, process.argv[2]);
  if (Object.hasOwn(metadata.versions, version)) {
    throw new Error(`versions.json already contains ${version}`);
  }
  metadata.pkg.version = version;
  metadata.lock.version = version;
  metadata.lock.packages[''].version = version;
  metadata.manifest.version = version;
  metadata.versions[version] = metadata.manifest.minAppVersion;
  validateMetadata(metadata);
  const values = [metadata.pkg, metadata.lock, metadata.manifest, metadata.versions];
  for (const [index, path] of paths.entries()) {
    const temporary = `${path}.version-bump-${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(values[index], null, 2)}\n`, { flag: 'wx' });
    staged.push(temporary);
  }
  for (const [index, path] of paths.entries()) {
    renameSync(staged[index], path);
    replaced.push(path);
  }
  console.log(`Updated ${current} → ${version}. Review the changes before committing.`);
} catch (error) {
  for (const path of replaced) {
    try {
      writeFileSync(path, originals.get(path));
    } catch (rollbackError) {
      console.error(`Could not restore ${path}: ${rollbackError.message}`);
    }
  }
  console.error(`Version bump failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const path of staged) {
    rmSync(path, { force: true });
  }
}
