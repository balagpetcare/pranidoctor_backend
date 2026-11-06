import { describe, expect, it } from 'vitest';

import { matchFromRank } from './discovery.areas.js';
import { mapProviderRow, type ProviderRow } from './discovery.mapper.js';

const baseRow: ProviderRow = {
  id: 'p1',
  name: '  ডা. রহিম  ',
  subtitle: 'ডিভিএম',
  photo: null,
  reg_no: 'BVC-1',
  verified: true,
  exp: 10,
  rating_avg: '4.76',
  rating_count: '120',
  fee_visit: 500,
  fee_emergency: '800',
  fee_online: null,
  fee_service: null,
  accepts_emergency: true,
  accepts_online: true,
  accepts_home_visit: false,
  tags: ['cattle_goat'],
  bio: null,
  is_online: true,
  match_rank: 1,
};

describe('matchFromRank', () => {
  it('maps ranks to labels using the ancestor chain', () => {
    const chain = ['UPAZILA', 'DISTRICT', 'DIVISION'];
    expect(matchFromRank(0, chain)).toBe('EXACT');
    expect(matchFromRank(1, chain)).toBe('NEAR');
    expect(matchFromRank(2, chain)).toBe('DISTRICT');
    expect(matchFromRank(3, chain)).toBe('REGION');
    expect(matchFromRank(null, chain)).toBe('REGION');
  });
});

describe('mapProviderRow', () => {
  it('normalises numbers, trims text and maps flags', () => {
    const card = mapProviderRow('DOCTOR', baseRow, ['UPAZILA', 'DISTRICT']);
    expect(card.name).toBe('ডা. রহিম');
    expect(card.rating).toEqual({ avg: 4.8, count: 120 });
    expect(card.fees).toEqual({ visit: 500, emergency: 800, online: null, service: null });
    expect(card.isOnline).toBe(true);
    expect(card.areaMatch).toBe('NEAR');
    expect(card.acceptsHomeVisit).toBe(false);
  });

  it('falls back to a kind-specific name and never leaks null arrays', () => {
    const card = mapProviderRow('HEALTH_WORKER', { ...baseRow, name: null, tags: null }, []);
    expect(card.name).toBe('প্রাণী স্বাস্থ্যকর্মী');
    expect(card.tags).toEqual([]);
  });

  it('does not expose internal identifiers', () => {
    const card = mapProviderRow('DOCTOR', baseRow, []) as unknown as Record<string, unknown>;
    expect(card).not.toHaveProperty('userId');
    expect(card).not.toHaveProperty('phone');
  });
});
