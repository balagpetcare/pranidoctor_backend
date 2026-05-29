function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Slow-query threshold for Prisma metrics + structured logs (ms). */
export function getSlowQueryThresholdMs(): number {
  return parsePositiveInt(process.env['DB_SLOW_QUERY_MS'], 200);
}

export function isHttpMetricsEnabled(): boolean {
  const raw = process.env['HTTP_METRICS_ENABLED']?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return process.env['METRICS_ENABLED'] !== 'false';
}
