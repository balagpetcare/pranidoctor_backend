export interface RollupValidationResult {
  bucketDate: string;
  logRequests: number;
  rollupRequests: number;
  logCostUsd: number;
  rollupCostUsd: number;
  logTokens: number;
  rollupTokens: number;
  driftRequests: number;
  driftCostUsd: number;
  withinTolerance: boolean;
  autoRepaired: boolean;
}

export const ROLLUP_DRIFT_COST_TOLERANCE_USD = 0.01;
