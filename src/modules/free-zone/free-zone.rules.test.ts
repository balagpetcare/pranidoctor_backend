import { describe, expect, it } from 'vitest';

import {
  checkFreeQuota,
  DEFAULT_FREE_ZONE_POLICY as P,
  parseFreeZonePolicy,
  type PastFreeRequest,
} from './free-zone.rules.js';

const at = (iso: string): PastFreeRequest => ({ at: new Date(iso), emergency: false });
const now = (iso: string) => new Date(iso);
const run = (past: PastFreeRequest[], when: string, isEmergency = false) =>
  checkFreeQuota({ now: now(when), policy: P, past, isEmergency });

describe('welcome period (first 30 days)', () => {
  it('allows the first request', () => {
    expect(run([], '2026-11-01T06:00:00Z').ok).toBe(true);
  });
  it('allows a second request on a later day', () => {
    expect(run([at('2026-11-01T06:00:00Z')], '2026-11-03T06:00:00Z').ok).toBe(true);
  });
  it('blocks a third request inside the 30 days', () => {
    const r = run([at('2026-11-01T06:00:00Z'), at('2026-11-03T06:00:00Z')], '2026-11-10T06:00:00Z');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('WELCOME_LIMIT');
      expect(r.nextAvailableAt.toISOString()).toBe('2026-12-01T06:00:00.000Z');
    }
  });
});

describe('daily limit', () => {
  it('blocks two requests on the same Dhaka day', () => {
    const r = run([at('2026-11-01T02:00:00Z')], '2026-11-01T10:00:00Z');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DAILY_LIMIT');
  });
  it('treats the Dhaka midnight boundary (18:00Z) as a new day', () => {
    // 17:59Z Nov 1 = 23:59 Dhaka Nov 1 ; 18:01Z = 00:01 Dhaka Nov 2
    expect(run([at('2026-11-01T17:59:00Z')], '2026-11-01T18:01:00Z').ok).toBe(true);
  });
  it('reports next availability at the next Dhaka midnight', () => {
    const r = run([at('2026-11-01T02:00:00Z')], '2026-11-01T10:00:00Z');
    if (!r.ok) expect(r.nextAvailableAt.toISOString()).toBe('2026-11-01T18:00:00.000Z');
  });
});

describe('after the welcome period', () => {
  const past = [at('2026-11-01T06:00:00Z'), at('2026-11-03T06:00:00Z')];
  it('allows one request in the first month after the window', () => {
    expect(run(past, '2026-12-05T06:00:00Z').ok).toBe(true);
  });
  it('blocks a second request in the same calendar month', () => {
    const r = run([...past, at('2026-12-05T06:00:00Z')], '2026-12-20T06:00:00Z');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('MONTHLY_LIMIT');
      expect(r.nextAvailableAt.toISOString()).toBe('2026-12-31T18:00:00.000Z');
    }
  });
  it('allows again in the next month', () => {
    expect(run([...past, at('2026-12-05T06:00:00Z')], '2027-01-02T06:00:00Z').ok).toBe(true);
  });
});

describe('emergency and policy parsing', () => {
  it('exempts emergencies and does not count them', () => {
    const emergencies: PastFreeRequest[] = [
      { at: new Date('2026-11-01T06:00:00Z'), emergency: true },
      { at: new Date('2026-11-01T07:00:00Z'), emergency: true },
    ];
    expect(run(emergencies, '2026-11-01T08:00:00Z', true)).toEqual({ ok: true, exempt: true });
    expect(run(emergencies, '2026-11-01T08:00:00Z', false).ok).toBe(true);
  });
  it('parses overrides and ignores junk', () => {
    expect(parseFreeZonePolicy(null)).toEqual(P);
    expect(parseFreeZonePolicy({ welcomeLimit: 3, liveMaxTiles: 99, monthlyLimit: 'x' })).toEqual({
      ...P,
      welcomeLimit: 3,
    });
  });
  it('defaults to 2 free emergencies per day', () => {
    expect(P.emergencyDailyFree).toBe(2);
  });
  it('auto-hides a comment after 3 reports by default, bounded 1..50', () => {
    expect(P.commentReportAutoHide).toBe(3);
    expect(parseFreeZonePolicy({ commentReportAutoHide: 5 }).commentReportAutoHide).toBe(5);
    expect(parseFreeZonePolicy({ commentReportAutoHide: 0 }).commentReportAutoHide).toBe(3);
    expect(parseFreeZonePolicy({ commentReportAutoHide: 51 }).commentReportAutoHide).toBe(3);
  });
  it('keeps 4 tiles by default', () => {
    expect(P.liveMaxTiles).toBe(4);
  });
});
