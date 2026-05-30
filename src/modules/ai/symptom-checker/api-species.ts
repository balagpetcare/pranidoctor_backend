import type { LivestockSpecies } from '../../../generated/prisma/index.js';

/** Public API species labels (mobile / legacy). */
export const API_LIVESTOCK_SPECIES = [
  'CATTLE',
  'BUFFALO',
  'GOAT',
  'SHEEP',
  'POULTRY',
  'DUCK',
  'PIGEON',
  'OTHER',
] as const;

export type ApiLivestockSpecies = (typeof API_LIVESTOCK_SPECIES)[number];

const API_TO_PRISMA: Record<ApiLivestockSpecies, LivestockSpecies> = {
  CATTLE: 'COW',
  BUFFALO: 'BUFFALO',
  GOAT: 'GOAT',
  SHEEP: 'SHEEP',
  POULTRY: 'CHICKEN',
  DUCK: 'DUCK',
  PIGEON: 'PIGEON',
  OTHER: 'OTHER',
};

export function apiSpeciesToPrisma(species: ApiLivestockSpecies): LivestockSpecies {
  return API_TO_PRISMA[species];
}
