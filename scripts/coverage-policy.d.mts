export interface CoverageThresholds {
  lines: number;
  branches: number;
}
export function coverageThresholds(
  exception: unknown,
  version: string,
  today: string,
  repository?: string,
): CoverageThresholds;
export function loadCoverageThresholds(
  root?: string,
  today?: string,
  repository?: string,
): CoverageThresholds;
