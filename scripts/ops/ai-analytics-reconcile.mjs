#!/usr/bin/env node
/**
 * Ops fallback: run AI analytics reconciliation outside the worker cron.
 * Usage:
 *   node scripts/ops/ai-analytics-reconcile.mjs --date=2026-05-30
 *   node scripts/ops/ai-analytics-reconcile.mjs --run=validate
 *   node scripts/ops/ai-analytics-reconcile.mjs --run=monthly --month=2026-05
 */
import { config as loadEnv } from 'dotenv';
loadEnv();

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

async function main() {
  const { createPrismaClient } = await import('../../src/shared/database/prisma.js');
  const { loadConfig } = await import('../../src/shared/config/index.js');
  createPrismaClient({ config: loadConfig() });

  const run = args.run ?? 'daily';
  if (run === 'validate') {
    const { getAiRollupValidationService } = await import(
      '../../src/modules/ai/analytics/validation/ai-rollup-validation.service.js'
    );
    const date = args.date ? new Date(`${args.date}T00:00:00.000Z`) : new Date();
    const result = await getAiRollupValidationService().runDailyValidationJob(date);
    console.log(JSON.stringify({ run, result }, null, 2));
    return;
  }

  if (run === 'monthly') {
    const { runMonthlyMetricsJobForMonth, runMonthlyMetricsJob } = await import(
      '../../src/modules/ai/analytics/jobs/ai-monthly-metrics.job.js'
    );
    const { utcMonthStart } = await import(
      '../../src/modules/ai/analytics/usage/ai-usage-analytics.util.js'
    );
    const result = args.month
      ? await runMonthlyMetricsJobForMonth(utcMonthStart(new Date(`${args.month}-01T00:00:00.000Z`)))
      : await runMonthlyMetricsJob();
    console.log(JSON.stringify({ run, result }, null, 2));
    return;
  }

  const { runDailyMetricsJobForDate, runDailyMetricsJob } = await import(
    '../../src/modules/ai/analytics/jobs/ai-daily-metrics.job.js'
  );
  const { utcDayStart } = await import(
    '../../src/modules/ai/analytics/usage/ai-usage-analytics.util.js'
  );
  const result = args.date
    ? await runDailyMetricsJobForDate(utcDayStart(new Date(`${args.date}T00:00:00.000Z`)))
    : await runDailyMetricsJob();
  console.log(JSON.stringify({ run: 'daily', result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
