import { describe, expect, it } from 'vitest';

import { dedupeAreaNodes, mapAreaNode, pickLabel } from './area.mapper.js';

describe('area.mapper', () => {
  const row = {
    id: '1',
    slug: 'dhaka-division-geo',
    code: '30',
    name: 'Dhaka Division',
    nameBn: 'ঢাকা বিভাগ',
    nameEn: 'Dhaka Division',
    latitude: null,
    longitude: null,
    isVerified: true,
  };

  it('prefers Bengali label by default', () => {
    expect(pickLabel(row, 'bn')).toBe('ঢাকা বিভাগ');
    expect(pickLabel(row, 'en')).toBe('Dhaka Division');
  });

  it('maps area node DTO', () => {
    const node = mapAreaNode(row, 'DIVISION', null, 'bn');
    expect(node.level).toBe('DIVISION');
    expect(node.label).toBe('ঢাকা বিভাগ');
    expect(node.parentId).toBeNull();
  });

  it('dedupes by slug', () => {
    const a = mapAreaNode(row, 'DIVISION', null);
    const b = mapAreaNode({ ...row, id: '2' }, 'DIVISION', null);
    expect(dedupeAreaNodes([a, b])).toHaveLength(1);
  });
});
