import { describe, expect, it } from 'vitest';

import {
  allowedSpeciesFor,
  catalogUsable,
  checkFees,
  checkPrice,
  customSpeciesAllowed,
} from './partner-services.rules.js';

const petItem = {
  providerKinds: ['DOCTOR'],
  species: ['pet'],
  minPriceBdt: 1000,
  maxPriceBdt: 5000,
  isActive: true,
};
const fieldItem = {
  providerKinds: ['DOCTOR', 'AI_TECHNICIAN', 'HEALTH_WORKER'],
  species: ['cattle_goat', 'poultry_duck'],
  minPriceBdt: null,
  maxPriceBdt: null,
  isActive: true,
};

describe('partner services rules', () => {
  it('doctors follow approved tracks only', () => {
    const doc = allowedSpeciesFor('DOCTOR', ['cattle_goat']);
    expect(catalogUsable(petItem, 'DOCTOR', doc)).toBe(false);
    expect(catalogUsable(petItem, 'DOCTOR', allowedSpeciesFor('DOCTOR', ['cattle_goat', 'pet']))).toBe(true);
    expect(catalogUsable(fieldItem, 'DOCTOR', doc)).toBe(true);
  });
  it('lower roles only get what their role covers', () => {
    expect(catalogUsable(petItem, 'AI_TECHNICIAN', allowedSpeciesFor('AI_TECHNICIAN', []))).toBe(false);
    expect(catalogUsable(fieldItem, 'HEALTH_WORKER', allowedSpeciesFor('HEALTH_WORKER', []))).toBe(true);
    expect(catalogUsable({ ...fieldItem, isActive: false }, 'DOCTOR', ['cattle_goat'])).toBe(false);
  });
  it('checks price bounds and custom species', () => {
    expect(checkPrice(petItem, 999).ok).toBe(false);
    expect(checkPrice(petItem, 3000).ok).toBe(true);
    expect(checkPrice(petItem, 5001).ok).toBe(false);
    expect(customSpeciesAllowed(['pet'], ['cattle_goat']).ok).toBe(false);
    expect(customSpeciesAllowed([], ['pet']).ok).toBe(false);
    expect(customSpeciesAllowed(['pet'], ['pet']).ok).toBe(true);
  });
  it('requires a fee for an enabled channel', () => {
    expect(checkFees({}, { acceptsOnlineConsultation: true }).ok).toBe(false);
    expect(checkFees({}, { acceptsOnlineConsultation: true, onlineFeeBdt: 300 }).ok).toBe(true);
    expect(checkFees({ onlineFeeBdt: 300, acceptsOnlineConsultation: true }, { onlineFeeBdt: 0 }).ok).toBe(false);
    expect(checkFees({}, { visitFeeBdt: 999999 }).ok).toBe(false);
  });
});
