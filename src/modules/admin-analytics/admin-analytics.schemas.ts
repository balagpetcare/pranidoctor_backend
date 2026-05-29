import { z } from 'zod';

import { MAX_ANALYTICS_RANGE_DAYS } from './admin-analytics.constants.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const adminAnalyticsDateRangeSchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    activeUserDays: z.coerce.number().int().min(1).max(90).optional(),
    grain: z.enum(['day', 'week', 'month', 'year']).optional(),
    basis: z.enum(['paid', 'issued']).optional(),
    level: z.enum(['division', 'district', 'upazila']).optional(),
    format: z.enum(['json', 'csv']).optional(),
    report: z
      .enum(['overview', 'revenue', 'doctors', 'farmers', 'livestock', 'geography', 'system'])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z
      .enum(['consultations', 'rating', 'responseTime', 'earnings', 'completionRate'])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to) {
      const fromMs = Date.parse(`${data.from}T00:00:00.000Z`);
      const toMs = Date.parse(`${data.to}T23:59:59.999Z`);
      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
        ctx.addIssue({ code: 'custom', message: 'Invalid date range' });
        return;
      }
      if (fromMs > toMs) {
        ctx.addIssue({ code: 'custom', message: 'from must be before to' });
        return;
      }
      const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
      if (days > MAX_ANALYTICS_RANGE_DAYS) {
        ctx.addIssue({
          code: 'custom',
          message: `Date range must not exceed ${MAX_ANALYTICS_RANGE_DAYS} days`,
        });
      }
    }
  });

export type AdminAnalyticsDateRangeQuery = z.infer<typeof adminAnalyticsDateRangeSchema>;

export function parseAdminAnalyticsQuery(
  searchParams: URLSearchParams,
): { success: true; data: AdminAnalyticsDateRangeQuery } | { success: false; error: z.ZodError } {
  const parsed = adminAnalyticsDateRangeSchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    activeUserDays: searchParams.get('activeUserDays') ?? undefined,
    grain: searchParams.get('grain') ?? undefined,
    basis: searchParams.get('basis') ?? undefined,
    level: searchParams.get('level') ?? undefined,
    format: searchParams.get('format') ?? undefined,
    report: searchParams.get('report') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  return { success: true, data: parsed.data };
}
