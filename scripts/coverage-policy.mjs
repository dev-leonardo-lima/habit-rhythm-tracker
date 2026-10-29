import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const standard = Object.freeze({ lines: 80, branches: 80 });

function nonempty(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Coverage exception requires ${field}`);
  }
}

/** Validate a temporary, human-approved coverage exception for one version. */
export function coverageThresholds(exception, version, today, repository) {
  if (exception === null) {
    return { ...standard };
  }
  if (!exception || typeof exception !== 'object' || Array.isArray(exception)) {
    throw new Error('Coverage exception must be a JSON object');
  }
  for (const field of [
    'version',
    'scope',
    'reason',
    'risk',
    'remediation',
    'approvedBy',
    'approvalUrl',
    'expiresOn',
  ]) {
    nonempty(exception[field], field);
  }
  if (exception.version !== version) {
    throw new Error('Coverage exception must match the current plugin version');
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn) ||
    Number.isNaN(Date.parse(`${exception.expiresOn}T00:00:00Z`)) ||
    new Date(`${exception.expiresOn}T00:00:00Z`).toISOString().slice(0, 10) !==
      exception.expiresOn ||
    exception.expiresOn < today
  ) {
    throw new Error('Coverage exception is expired or has an invalid expiry date');
  }
  if (
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+#(?:pullrequestreview|issuecomment)-\d+$/.test(
      exception.approvalUrl,
    )
  ) {
    throw new Error('Coverage exception must link to a specific GitHub pull request approval');
  }
  const approvalRepository = new URL(exception.approvalUrl).pathname
    .split('/')
    .slice(1, 3)
    .join('/');
  if (repository && approvalRepository.toLowerCase() !== repository.toLowerCase()) {
    throw new Error('Coverage exception approval must reference this repository');
  }
  const thresholds = exception.thresholds;
  if (!thresholds || typeof thresholds !== 'object' || Array.isArray(thresholds)) {
    throw new Error('Coverage exception requires line and branch thresholds');
  }
  for (const field of ['lines', 'branches']) {
    if (
      typeof thresholds[field] !== 'number' ||
      !Number.isFinite(thresholds[field]) ||
      thresholds[field] < 0 ||
      thresholds[field] > 100
    ) {
      throw new Error(`Invalid ${field} coverage threshold`);
    }
  }
  if (thresholds.lines >= standard.lines && thresholds.branches >= standard.branches) {
    throw new Error('Coverage exception does not lower either standard threshold');
  }
  return { lines: thresholds.lines, branches: thresholds.branches };
}

export function loadCoverageThresholds(
  root = process.cwd(),
  today = new Date().toISOString().slice(0, 10),
  repository = process.env.GITHUB_REPOSITORY,
) {
  const path = join(root, '.github', 'coverage-exception.json');
  if (!existsSync(path)) {
    return { ...standard };
  }
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const exception = JSON.parse(readFileSync(path, 'utf8'));
  return coverageThresholds(exception, manifest.version, today, repository);
}
