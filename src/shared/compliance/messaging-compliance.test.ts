import { describe, expect, it } from 'vitest';

import { validateLegalSafeMessaging } from './messaging-compliance.js';

describe('validateLegalSafeMessaging', () => {
  it('allows negated guarantee language', () => {
    const r = validateLegalSafeMessaging(
      'Emergency booking does not guarantee immediate response or arrival.',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects typical response ETA', () => {
    const r = validateLegalSafeMessaging('Typical response: 5–15 min');
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.pattern === 'typical_response')).toBe(true);
  });

  it('rejects positive guarantee', () => {
    const r = validateLegalSafeMessaging('Guaranteed response within 10 minutes');
    expect(r.ok).toBe(false);
  });

  it('allows factual assignment copy', () => {
    const r = validateLegalSafeMessaging('Your request is waiting for assignment.');
    expect(r.ok).toBe(true);
  });
});
