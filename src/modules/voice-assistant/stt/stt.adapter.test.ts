import { describe, expect, it } from 'vitest';

import { BanglaSttAdapter } from './stt.adapter.js';

describe('stt.adapter', () => {
  it('does not call AI — returns normalized text only', () => {
    const adapter = new BanglaSttAdapter();
    const out = adapter.transcribe({
      transcript: 'gorur jor',
      locale: 'bn',
      confidence: 0.8,
    });
    expect(out.normalizedText).toContain('গরু');
    expect(out).not.toHaveProperty('aiResponse');
  });
});
