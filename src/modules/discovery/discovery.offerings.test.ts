import { describe, expect, it } from 'vitest';

import { offeringCreateSchema, offeringUpdateSchema } from './discovery.offerings.js';

const valid = { title: 'বাড়িতে গাভীর চিকিৎসা', mode: 'HOME_VISIT', priceBdt: 800 };

describe('offering schemas', () => {
  it('accepts a minimal valid service and applies defaults', () => {
    const r = offeringCreateSchema.parse(valid);
    expect(r.species).toEqual([]);
    expect(r.isActive).toBe(true);
  });

  it('rejects negative or absurd prices, short titles and unknown modes', () => {
    expect(offeringCreateSchema.safeParse({ ...valid, priceBdt: -1 }).success).toBe(false);
    expect(offeringCreateSchema.safeParse({ ...valid, priceBdt: 1e9 }).success).toBe(false);
    expect(offeringCreateSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(false);
    expect(offeringCreateSchema.safeParse({ ...valid, mode: 'FREE_MONEY' }).success).toBe(false);
  });

  it('is strict: unknown keys (e.g. providerId, adminHidden) are rejected', () => {
    expect(offeringCreateSchema.safeParse({ ...valid, providerId: 'x' }).success).toBe(false);
    expect(offeringUpdateSchema.safeParse({ adminHidden: false }).success).toBe(false);
  });

  it('update requires at least one field', () => {
    expect(offeringUpdateSchema.safeParse({}).success).toBe(false);
    expect(offeringUpdateSchema.safeParse({ priceBdt: 500 }).success).toBe(true);
  });
});
