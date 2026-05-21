import { describe, expect, it } from 'vitest';

import { sanitizeObject, sanitizeValue } from './sanitizer.js';

describe('sanitizer', () => {
  it('redacts sensitive top-level keys', () => {
    expect(sanitizeValue('password', 'secret')).toBe('[REDACTED]');
    expect(sanitizeValue('refresh_token', 'abc')).toBe('[REDACTED]');
    expect(sanitizeValue('name', 'visible')).toBe('visible');
  });

  it('redacts nested sensitive fields', () => {
    const result = sanitizeObject({
      user: { name: 'Alice', otp: '123456' },
      token: 'jwt-value',
    }) as Record<string, unknown>;

    expect(result['token']).toBe('[REDACTED]');
    expect((result['user'] as Record<string, unknown>)['otp']).toBe('[REDACTED]');
    expect((result['user'] as Record<string, unknown>)['name']).toBe('Alice');
  });
});
