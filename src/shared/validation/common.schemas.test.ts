import { describe, expect, it } from 'vitest';

import {
  bdPhoneSchema,
  otpCodeSchema,
  paginationSchema,
  dateRangeSchema,
  bdtAmountSchema,
  emailSchema,
} from './common.schemas.js';

describe('common.schemas', () => {
  it('normalizes Bangladesh phone numbers', () => {
    expect(bdPhoneSchema.parse('01712345678')).toBe('+8801712345678');
    expect(bdPhoneSchema.parse('+8801712345678')).toBe('+8801712345678');
    expect(bdPhoneSchema.parse('8801712345678')).toBe('+8801712345678');
  });

  it('rejects invalid phone numbers', () => {
    expect(() => bdPhoneSchema.parse('12345')).toThrow();
  });

  it('validates OTP codes', () => {
    expect(otpCodeSchema.parse('123456')).toBe('123456');
    expect(() => otpCodeSchema.parse('12345')).toThrow();
  });

  it('applies pagination defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
  });

  it('validates date ranges', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    expect(dateRangeSchema.parse({ from, to })).toEqual({ from, to });
    expect(() =>
      dateRangeSchema.parse({ from: to, to: from })
    ).toThrow();
  });

  it('validates BDT amounts', () => {
    expect(bdtAmountSchema.parse(100.5)).toBe(100.5);
    expect(() => bdtAmountSchema.parse(-1)).toThrow();
    expect(() => bdtAmountSchema.parse(100.001)).toThrow();
  });

  it('validates email addresses', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });
});
