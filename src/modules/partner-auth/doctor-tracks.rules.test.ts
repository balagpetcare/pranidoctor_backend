import { describe, expect, it } from 'vitest';

import { baseTracksFrom, canApplyPetTrack, speciesFocusFor, trackForSpecies } from './doctor-tracks.rules.js';

describe('doctor tracks', () => {
  it('maps species and keeps pet out of base tracks', () => {
    expect(baseTracksFrom(['cattle_goat', 'pet', 'poultry_duck', 'cattle_goat'])).toEqual([
      'CATTLE_GOAT',
      'POULTRY_DUCK',
    ]);
    expect(trackForSpecies('pet')).toBe('PET');
    expect(trackForSpecies('cow')).toBeNull();
  });
  it('mirrors only active tracks into speciesFocus', () => {
    expect(
      speciesFocusFor([
        { kind: 'PET', status: 'PENDING_VERIFICATION' },
        { kind: 'CATTLE_GOAT', status: 'ACTIVE' },
      ]),
    ).toEqual(['cattle_goat']);
  });
  it('gates the pet application', () => {
    expect(canApplyPetTrack('PENDING_VERIFICATION', null).ok).toBe(false);
    expect(canApplyPetTrack('ACTIVE', null).ok).toBe(true);
    expect(canApplyPetTrack('ACTIVE', { status: 'PENDING_VERIFICATION', reviewNote: null }).ok).toBe(false);
    expect(canApplyPetTrack('ACTIVE', { status: 'PENDING_VERIFICATION', reviewNote: 'আরও কাগজ' }).ok).toBe(true);
    expect(canApplyPetTrack('ACTIVE', { status: 'REJECTED', reviewNote: 'x' }).ok).toBe(true);
    expect(canApplyPetTrack('ACTIVE', { status: 'ACTIVE', reviewNote: null }).ok).toBe(false);
  });
});
