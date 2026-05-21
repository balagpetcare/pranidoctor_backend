import { describe, expect, it } from 'vitest';

import { resolveBandwidthPolicy, TranscriptFirstTtsAdapter } from './tts.adapter.js';

describe('tts.adapter bandwidth', () => {
  it('uses transcript-only for TRANSCRIPT_ONLY mode', () => {
    const policy = resolveBandwidthPolicy('TRANSCRIPT_ONLY');
    expect(policy.transcriptOnly).toBe(true);
    expect(policy.codec).toBeNull();
  });

  it('uses low bitrate for LOW mode (2G/3G target)', () => {
    const policy = resolveBandwidthPolicy('LOW');
    expect(policy.bitrateKbps).toBe(16);
  });

  it('truncates response in low token mode', () => {
    const adapter = new TranscriptFirstTtsAdapter();
    const long = 'Sentence one. Sentence two. Sentence three. '.repeat(5);
    const out = adapter.synthesize({
      text: long,
      locale: 'bn',
      bandwidthMode: 'FULL',
      lowTokenMode: true,
    });
    expect(out.text.length).toBeLessThan(long.length);
  });
});

describe('offline / queue hint', () => {
  it('stores no audio payload in transcript-only synthesis', () => {
    const adapter = new TranscriptFirstTtsAdapter();
    const out = adapter.synthesize({
      text: 'সাহায্য',
      locale: 'bn',
      bandwidthMode: 'TRANSCRIPT_ONLY',
    });
    expect(out.audioAvailable).toBe(false);
    expect(out.transcriptOnly).toBe(true);
  });
});
