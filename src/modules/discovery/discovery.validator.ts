import { z } from 'zod';

import { HUB_CATEGORY_KEYS, PROVIDER_KINDS, PROVIDER_SORTS } from './discovery.types.js';

/** cuid / seeded ids only — rejects anything that could be abused as a path or SQL fragment. */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, 'Invalid id');

const boolFlag = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const hubQuerySchema = z
  .object({
    areaId: idSchema.optional(),
  })
  .strict();

export const providerListQuerySchema = z
  .object({
    category: z.enum(HUB_CATEGORY_KEYS).optional(),
    kind: z.enum(PROVIDER_KINDS).optional(),
    areaId: idSchema.optional(),
    online: boolFlag.optional(),
    homeVisit: boolFlag.optional(),
    emergency: boolFlag.optional(),
    sort: z.enum(PROVIDER_SORTS).default('recommended'),
    page: z.coerce.number().int().min(1).max(20).default(1),
    limit: z.coerce.number().int().min(1).max(30).default(15),
  })
  .strict()
  .refine((q) => q.category !== undefined || q.kind !== undefined, {
    message: 'category or kind is required',
    path: ['category'],
  });

export const providerParamsSchema = z
  .object({
    kind: z.enum(PROVIDER_KINDS),
    id: idSchema,
  })
  .strict();

export const providerDetailQuerySchema = z.object({ areaId: idSchema.optional() }).strict();

export const presenceBodySchema = z
  .object({
    online: z.boolean(),
  })
  .strict();

export type HubQuery = z.infer<typeof hubQuerySchema>;
export type ProviderListQuery = z.infer<typeof providerListQuerySchema>;
export type PresenceBody = z.infer<typeof presenceBodySchema>;
