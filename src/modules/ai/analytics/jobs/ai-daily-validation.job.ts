import { getAiRollupValidationService } from '../validation/ai-rollup-validation.service.js';

/** Run daily rollup validation for yesterday (used by worker cron and ops scripts). */
export async function runDailyRollupValidationJob(referenceDate: Date = new Date()) {
  return getAiRollupValidationService().runDailyValidationJob(referenceDate);
}
