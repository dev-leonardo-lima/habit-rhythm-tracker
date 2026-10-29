import { GitHubReleaseApi } from './github-release-api.mjs';
import { reconcileReleases } from './release-engine.mjs';

try {
  const api = new GitHubReleaseApi({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    apiUrl: process.env.GITHUB_API_URL,
    serverUrl: process.env.GITHUB_SERVER_URL,
    runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    runId: process.env.GITHUB_RUN_ID,
  });
  const action = process.argv[2];
  if (action === 'capture') {
    await api.capture(process.env.PUSH_BEFORE, process.env.PUSH_AFTER);
    console.log('Push receipt recorded.');
  } else if (action === 'reconcile') {
    if (process.env.RELEASE_BASELINE) {
      await api.initialize(process.env.RELEASE_BASELINE);
      console.log('Release cursor initialized.');
    }
    const result = await reconcileReleases(api);
    console.log(JSON.stringify(result));
  } else {
    throw new Error('Usage: node scripts/release-cli.mjs capture|reconcile');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const token = process.env.GITHUB_TOKEN;
  console.error(
    `Release automation stopped: ${token ? message.replaceAll(token, '[redacted]') : message}`,
  );
  process.exitCode = 1;
}
