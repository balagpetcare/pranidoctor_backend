import { describe, expect, it } from 'vitest';

import {
  hubQuerySchema,
  presenceBodySchema,
  providerListQuerySchema,
  providerParamsSchema,
} from './discovery.validator.js';

describe('discovery validators', () => {
  it('requires category or kind for provider lists', () => {
    expect(providerListQuerySchema.safeParse({}).success).toBe(false);
    expect(providerListQuerySchema.safeParse({ category: 'cattle_goat' }).success).toBe(true);
    expect(providerListQuerySchema.safeParse({ kind: 'AI_TECHNICIAN' }).success).toBe(true);
  });

  it('applies defaults and coerces query strings', () => {
    const parsed = providerListQuerySchema.parse({ category: 'pet', page: '2', limit: '10', online: 'true' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.online).toBe(true);
    expect(parsed.sort).toBe('recommended');
  });

  it('caps page and page size to protect the database', () => {
    expect(providerListQuerySchema.safeParse({ category: 'pet', limit: '500' }).success).toBe(false);
    expect(providerListQuerySchema.safeParse({ category: 'pet', page: '999' }).success).toBe(false);
  });

  it('rejects unknown keys and unsafe ids', () => {
    expect(providerListQuerySchema.safeParse({ category: 'pet', foo: 'bar' }).success).toBe(false);
    expect(hubQuerySchema.safeParse({ areaId: "x'; DROP TABLE users;--" }).success).toBe(false);
    expect(hubQuerySchema.safeParse({ areaId: 'cm1abcdefgh' }).success).toBe(true);
    expect(providerParamsSchema.safeParse({ kind: 'ADMIN', id: 'cm1abcdefgh' }).success).toBe(false);
  });

  it('presence body must be a strict boolean', () => {
    expect(presenceBodySchema.safeParse({ online: true }).success).toBe(true);
    expect(presenceBodySchema.safeParse({ online: 'true' }).success).toBe(false);
    expect(presenceBodySchema.safeParse({ online: true, userId: 'x' }).success).toBe(false);
  });
});
