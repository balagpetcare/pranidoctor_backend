import type { AdminAnalyticsDateRangeQuery } from './admin-analytics.schemas.js';

export type ResolvedDateRange = {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
  previousFrom: Date;
  previousTo: Date;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

function formatKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveAnalyticsDateRange(
  query: AdminAnalyticsDateRangeQuery,
): ResolvedDateRange {
  const now = new Date();
  const to = query.to ? endOfUtcDay(new Date(`${query.to}T00:00:00.000Z`)) : endOfUtcDay(now);
  const from = query.from
    ? startOfUtcDay(new Date(`${query.from}T00:00:00.000Z`))
    : startOfUtcDay(new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));

  const spanMs = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - spanMs + 1);

  return {
    from,
    to,
    fromKey: formatKey(from),
    toKey: formatKey(to),
    previousFrom: startOfUtcDay(previousFrom),
    previousTo: endOfUtcDay(previousTo),
  };
}
