export interface ReleaseCursor {
  baseline: string;
  lastConsumed: string;
  latestPublishedVersion?: string | null;
  latestPublishedTag?: string | null;
  lastReconciledAt?: string | null;
}
export interface ReleaseAdapter {
  readCursor(): Promise<ReleaseCursor | null>;
  readMainHead(): Promise<string>;
  listReceipts(): Promise<Array<{ before: string; after: string }>>;
  isAncestor(before: string, after: string): Promise<boolean>;
  validatedRun(sha: string): Promise<unknown | null>;
  readMetadata(sha: string): Promise<unknown>;
  readBuild(validation: unknown, sha: string): Promise<unknown>;
  publishRelease(candidate: {
    version: string;
    sha: string;
    validation: unknown;
    build: unknown;
    receipt: { before: string; after: string } | undefined;
  }): Promise<void>;
  updateCursor(cursor: ReleaseCursor): Promise<void>;
  updateReceipt(
    receipt: { before: string; after: string },
    update: Record<string, unknown>,
  ): Promise<void>;
  redact(value: string): string;
}
export function reconcileReleases(api: ReleaseAdapter): Promise<{
  processed: Array<{ before: string; after: string; version: string; released: boolean }>;
  waitingFor: string;
}>;
