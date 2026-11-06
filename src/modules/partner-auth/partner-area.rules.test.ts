import { describe, expect, it } from 'vitest';

import { areaLimitsFor, checkAreaSelection, checkProfile, type AreaPick } from './partner-area.rules.js';

const d = (id: string): AreaPick => ({ id, type: 'DISTRICT', parentId: 'div', isActive: true });
const u = (id: string, parentId: string): AreaPick => ({ id, type: 'UPAZILA', parentId, isActive: true });
const L = areaLimitsFor('AI_TECHNICIAN'); // 2 districts, 4 upazilas

describe('checkAreaSelection', () => {
  it('accepts within limits and dedupes', () => {
    const r = checkAreaSelection(['d1', 'd1', 'u1'], [d('d1'), u('u1', 'dX')], L);
    expect(r).toEqual({ ok: true, ids: ['d1', 'u1'] });
  });
  it('rejects too many districts', () => {
    expect(checkAreaSelection(['d1', 'd2', 'd3'], [d('d1'), d('d2'), d('d3')], L).ok).toBe(false);
  });
  it('rejects too many upazilas', () => {
    const ups = [1, 2, 3, 4, 5].map((i) => u(`u${i}`, 'dX'));
    expect(checkAreaSelection(ups.map((x) => x.id), ups, L).ok).toBe(false);
  });
  it('rejects an upazila inside a selected district', () => {
    expect(checkAreaSelection(['d1', 'u1'], [d('d1'), u('u1', 'd1')], L).ok).toBe(false);
  });
  it('rejects unknown, inactive and wrong-type areas', () => {
    expect(checkAreaSelection(['zz'], [], L).ok).toBe(false);
    expect(checkAreaSelection(['d1'], [{ ...d('d1'), isActive: false }], L).ok).toBe(false);
    expect(checkAreaSelection(['v1'], [{ id: 'v1', type: 'VILLAGE', parentId: null, isActive: true }], L).ok).toBe(false);
  });
  it('allows an empty selection', () => {
    expect(checkAreaSelection([], [], L)).toEqual({ ok: true, ids: [] });
  });
});

describe('limits and profile', () => {
  it('doctor limits exceed AI technician limits', () => {
    expect(areaLimitsFor('DOCTOR').districts).toBeGreaterThan(L.districts);
  });
  it('validates profile fields', () => {
    expect(checkProfile({ displayName: 'ড', bio: null }).ok).toBe(false);
    expect(checkProfile({ displayName: 'ডা. করিম', experienceYears: 8 }).ok).toBe(true);
    expect(checkProfile({ experienceYears: -1 }).ok).toBe(false);
    expect(checkProfile({ experienceYears: 2.5 }).ok).toBe(false);
  });
});
