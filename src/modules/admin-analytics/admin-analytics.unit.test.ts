import { describe, expect, it } from 'vitest';

import { resolveAnalyticsDateRange } from './admin-analytics.date-range.js';
import { parseAdminAnalyticsQuery } from './admin-analytics.schemas.js';
import { serviceRequestStatusLabel } from './admin-analytics.labels.js';
import { ServiceRequestStatus } from '../../generated/prisma/index.js';

describe('admin-analytics.date-range', () => {
  it('defaults to 30-day window ending today', () => {
    const range = resolveAnalyticsDateRange({});
    expect(range.fromKey <= range.toKey).toBe(true);
    const spanDays =
      (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThanOrEqual(28);
    expect(spanDays).toBeLessThanOrEqual(31);
  });

  it('rejects inverted ranges', () => {
    const parsed = parseAdminAnalyticsQuery(
      new URLSearchParams({ from: '2026-05-20', to: '2026-05-01' }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects ranges over 366 days', () => {
    const parsed = parseAdminAnalyticsQuery(
      new URLSearchParams({ from: '2024-01-01', to: '2026-05-29' }),
    );
    expect(parsed.success).toBe(false);
  });
});

describe('admin-analytics.labels', () => {
  it('maps known statuses', () => {
    expect(serviceRequestStatusLabel(ServiceRequestStatus.COMPLETED)).toBe('Completed');
  });
});
