import type { Logger } from 'pino';

import { Counter, LatencyHistogram } from './prometheus-series.js';
import { getSlowQueryThresholdMs } from './monitoring-config.js';

const DB_BUCKETS_SEC = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const dbQueriesTotal = new Counter();
const dbQueryDuration = new LatencyHistogram(DB_BUCKETS_SEC);
const dbSlowQueriesTotal = new Counter();

export type DbQueryMetricInput = {
  model: string;
  operation: string;
  durationMs: number;
  logger?: Logger;
};

export function recordDbQuery(input: DbQueryMetricInput): void {
  const model = input.model || 'unknown';
  const operation = input.operation || 'unknown';

  dbQueriesTotal.inc({ model, operation });
  dbQueryDuration.observe({ model, operation }, input.durationMs / 1000);

  const thresholdMs = getSlowQueryThresholdMs();
  if (input.durationMs >= thresholdMs) {
    dbSlowQueriesTotal.inc({ model, operation });
    input.logger?.warn(
      {
        event: 'db.query.slow',
        model,
        operation,
        durationMs: Math.round(input.durationMs),
        thresholdMs,
      },
      'Slow database query',
    );
  }
}

export function renderDbPrometheusLines(): string[] {
  return [
    ...dbQueriesTotal.entries(
      'pranidoctor_db_queries_total',
      'Total Prisma database queries by model and operation',
    ),
    ...dbQueryDuration.entries(
      'pranidoctor_db_query_duration_seconds',
      'Prisma query latency in seconds',
    ),
    ...dbSlowQueriesTotal.entries(
      'pranidoctor_db_slow_queries_total',
      'Database queries exceeding DB_SLOW_QUERY_MS threshold',
    ),
  ];
}

export function resetDbMetricsForTests(): void {
  dbQueriesTotal.clear();
  dbQueryDuration.clear();
  dbSlowQueriesTotal.clear();
}
