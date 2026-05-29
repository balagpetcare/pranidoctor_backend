import { describe, expect, it, beforeEach } from 'vitest';

import { AlertDeduplicator } from './alert-deduplicator.js';

describe('AlertDeduplicator', () => {
  let dedup: AlertDeduplicator;

  beforeEach(() => {
    dedup = new AlertDeduplicator(60_000, 5, () => 100);
  });

  it('allows first alert', () => {
    const d = dedup.evaluate('ALT-DOWN-02', 'critical');
    expect(d.allow).toBe(true);
    expect(d.repeatCount).toBe(1);
    expect(d.deduplicated).toBe(false);
  });

  it('suppresses duplicate within window', () => {
    dedup.evaluate('ALT-DOWN-02', 'critical');
    const d = dedup.evaluate('ALT-DOWN-02', 'critical');
    expect(d.allow).toBe(false);
    expect(d.deduplicated).toBe(true);
    expect(d.repeatCount).toBe(2);
  });

  it('escalates after threshold repeats', () => {
    for (let i = 0; i < 4; i++) {
      dedup.evaluate('ALT-ERR-01', 'warning');
    }
    const d = dedup.evaluate('ALT-ERR-01', 'warning');
    expect(d.allow).toBe(true);
    expect(d.escalated).toBe(true);
    expect(d.escalationLevel).toBe(1);
  });

  it('enforces storm limit per severity', () => {
    const strict = new AlertDeduplicator(1, 100, () => 2);
    strict.evaluate('A:1', 'critical');
    strict.evaluate('A:2', 'critical');
    const blocked = strict.evaluate('A:3', 'critical');
    expect(blocked.allow).toBe(false);
    expect(blocked.stormSuppressed).toBe(true);
  });
});
