import { describe, expect, it } from 'vitest';

import { AREA_SEED_VERSION } from './area-seed.service.js';

describe('area-seed.service', () => {
  it('declares stable seed version', () => {
    expect(AREA_SEED_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}-area-engine-/);
  });
});
