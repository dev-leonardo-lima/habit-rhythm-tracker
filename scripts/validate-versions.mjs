import { execFileSync } from 'node:child_process';
import { compareVersions, readMetadata, validateMetadata } from './version-metadata.mjs';

try {
  const version = validateMetadata(readMetadata());
  const base = process.env.BASE_SHA;
  if (base && !/^0+$/.test(base)) {
    if (!/^[0-9a-f]{40}$/.test(base)) {
      throw new Error('BASE_SHA must be a full commit SHA');
    }
    const previous = validateMetadata(
      readMetadata((file) =>
        execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' }),
      ),
    );
    if (compareVersions(version, previous) < 0) {
      throw new Error(`Version ${version} is older than ${previous}`);
    }
  }
  console.log(`Version metadata is consistent: ${version}`);
} catch (error) {
  console.error(`Version validation failed: ${error.message}`);
  process.exitCode = 1;
}
