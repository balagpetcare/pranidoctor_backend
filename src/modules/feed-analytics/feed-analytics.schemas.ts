import { z } from 'zod';

const farmRefSchema = z.string().trim().min(1).max(200);
const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const feedAnalyticsRangeQuerySchema = z.object({
  farmRef: farmRefSchema,
  from: dateStringSchema,
  to: dateStringSchema,
});

export type FeedAnalyticsRangeQuery = z.infer<typeof feedAnalyticsRangeQuerySchema>;
