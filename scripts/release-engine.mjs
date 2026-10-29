import { compareVersions, validateMetadata } from './version-metadata.mjs';

async function updateReceipts(api, receipts, update) {
  for (const receipt of receipts) {
    await api.updateReceipt(receipt, update);
  }
}

function summarizeValidation(validation, sha) {
  return {
    sourceSha: sha,
    runId: validation.id ?? null,
    runUrl: validation.html_url ?? null,
    conclusion: validation.conclusion ?? null,
    checks: validation.checks ?? null,
    coverage: validation.coverage ?? null,
  };
}

/** Process only the contiguous, validated push chain. The adapter performs all I/O. */
export async function reconcileReleases(api) {
  let cursor = await api.readCursor();
  if (!cursor) {
    throw new Error('Release cursor is not initialized; see docs/releasing.md');
  }
  const receipts = await api.listReceipts();
  const processed = [];
  for (;;) {
    const matches = receipts.filter((receipt) => receipt.before === cursor.lastConsumed);
    const afters = [...new Set(matches.map((receipt) => receipt.after))];
    if (afters.length > 1) {
      const message = `Ambiguous push chain after ${cursor.lastConsumed}; inspect the conflicting receipt issues before retrying`;
      await updateReceipts(api, matches, { status: 'blocked', error: message });
      throw new Error(message);
    }
    if (afters.length === 0) {
      const head = await api.readMainHead();
      return {
        processed,
        waitingFor:
          head === cursor.lastConsumed ? 'idle' : `receipt:${cursor.lastConsumed}→${head}`,
      };
    }
    const after = afters[0];
    const before = cursor.lastConsumed;
    let summary = null;
    let bumpClassification = null;
    let finalStatusWritten = false;
    try {
      if (before === after || !(await api.isAncestor(before, after))) {
        throw new Error(`Non-linear push: ${before} → ${after}; reconcile manually`);
      }
      const validation = await api.validatedRun(after);
      if (!validation) {
        await updateReceipts(api, matches, { status: 'awaiting-validation' });
        return { processed, waitingFor: `validation:${after}` };
      }
      summary = summarizeValidation(validation, after);
      const previous = validateMetadata(await api.readMetadata(before));
      const current = validateMetadata(await api.readMetadata(after));
      const comparison = compareVersions(current, previous);
      if (comparison < 0) {
        throw new Error(`Version ${current} is older than ${previous}`);
      }
      bumpClassification = comparison > 0 ? 'bump' : 'unchanged';
      await updateReceipts(api, matches, {
        status: 'validated',
        validation: summary,
        bumpClassification,
      });
      if (comparison > 0) {
        const build = await api.readBuild(validation, after);
        await api.publishRelease({
          version: current,
          sha: after,
          validation,
          build,
          receipt: matches[0],
        });
      }
      await updateReceipts(api, matches, {
        status: comparison > 0 ? 'published' : 'validation-only-complete',
        validation: summary,
        bumpClassification,
      });
      finalStatusWritten = true;
      cursor = {
        ...cursor,
        lastConsumed: after,
        lastReconciledAt: new Date().toISOString(),
        ...(comparison > 0 ? { latestPublishedVersion: current, latestPublishedTag: current } : {}),
      };
      await api.updateCursor(cursor);
      processed.push({ before, after, version: current, released: comparison > 0 });
    } catch (error) {
      const message = api.redact(error instanceof Error ? error.message : String(error));
      if (finalStatusWritten) {
        throw new Error(`${message}; the event was processed, so retry cursor reconciliation`, {
          cause: error,
        });
      }
      try {
        await updateReceipts(api, matches, {
          status: 'blocked',
          validation: summary,
          bumpClassification,
          error: message,
        });
      } catch (receiptError) {
        throw new Error(
          `${message}; could not record receipt status: ${api.redact(receiptError instanceof Error ? receiptError.message : String(receiptError))}`,
          { cause: receiptError },
        );
      }
      throw new Error(message, { cause: error });
    }
  }
}
