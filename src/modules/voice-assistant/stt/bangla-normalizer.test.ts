import { describe, expect, it } from 'vitest';

import {
  evaluateConfidence,
  normalizeBanglaUtterance,
} from './bangla-normalizer.js';

describe('bangla-normalizer', () => {
  it('maps common Banglish tokens to Bangla', () => {
    expect(normalizeBanglaUtterance('amar gorur jor hocche', 'bn')).toContain('গরুর');
  });

  it('suggests retry for low confidence', () => {
    const result = evaluateConfidence(0.3);
    expect(result.retrySuggested).toBe(true);
    expect(result.fallbackHint).toBeTruthy();
  });

  it('passes high confidence without retry', () => {
    const result = evaluateConfidence(0.85);
    expect(result.retrySuggested).toBe(false);
  });
});
