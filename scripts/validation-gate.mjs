export const REQUIRED_CHECKS = [
  'Validate version',
  'Typecheck',
  'Lint',
  'Format',
  'Test and coverage',
  'Production build',
];

/** Select the latest main-push validation for exactly this revision. */
export function selectValidationRun(runs, sha) {
  const candidates = runs.filter(
    (run) => run.head_sha === sha && run.head_branch === 'main' && run.event === 'push',
  );
  candidates.sort(
    (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || b.id - a.id,
  );
  const run = candidates[0];
  if (!run || run.status !== 'completed') {
    return null;
  }
  if (run.conclusion !== 'success') {
    throw new Error(`CI validation failed for ${sha}: ${run.html_url}`);
  }
  return run;
}

/** Require all quality checks to have passed in the validation job. */
export function requireSuccessfulChecks(run, jobs) {
  const job = jobs.find((item) => item.name === 'validate' && item.conclusion === 'success');
  if (
    !job ||
    !Array.isArray(job.steps) ||
    REQUIRED_CHECKS.some(
      (name) => !job.steps.some((step) => step.name === name && step.conclusion === 'success'),
    )
  ) {
    throw new Error(`CI run ${run.id} is missing a successful required check`);
  }
  return Object.fromEntries(REQUIRED_CHECKS.map((name) => [name, 'success']));
}
