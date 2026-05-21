import { describe, expect, it } from 'vitest';

import { AREA_ENGINE_VILLAGE_ROWS, AREA_SEED_VERSION } from '../../../scripts/area-seed-lib.js';

describe('area-seed-lib', () => {
  it('includes village rows for union slugs', () => {
    expect(AREA_SEED_VERSION).toContain('area-engine');
    expect(AREA_ENGINE_VILLAGE_ROWS[0]?.unionSlug).toContain('union');
  });
});
