import { describe, expect, it } from 'vitest';

import { isProfileComplete, readAreaLabel } from './customer-address.schema.js';

describe('customer-address.schema', () => {
  it('reads area label from compat keys', () => {
    expect(readAreaLabel({ areaLabel: 'Dhaka' })).toBe('Dhaka');
    expect(readAreaLabel({ area: 'Sylhet' })).toBe('Sylhet');
    expect(readAreaLabel(null)).toBeNull();
  });

  it('profileComplete when name and village or area', () => {
    expect(
      isProfileComplete({
        displayName: 'Rahim',
        addressJson: null,
        primaryVillageId: 'v1',
      }),
    ).toBe(true);
    expect(
      isProfileComplete({
        displayName: 'Rahim',
        addressJson: { areaLabel: 'Village' },
        primaryVillageId: null,
      }),
    ).toBe(true);
    expect(
      isProfileComplete({
        displayName: '',
        addressJson: { areaLabel: 'Village' },
        primaryVillageId: null,
      }),
    ).toBe(false);
  });
});
