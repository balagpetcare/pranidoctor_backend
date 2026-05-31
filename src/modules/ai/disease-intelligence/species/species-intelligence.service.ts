import type { DiPrevalenceBand, LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';

const BAND_BOOST: Record<DiPrevalenceBand, number> = {
  ENDEMIC: 0.15,
  COMMON: 0.1,
  UNCOMMON: 0.05,
  RARE: 0,
};

export class SpeciesIntelligenceService {
  readonly name = 'SpeciesIntelligenceService';

  async prevalenceBoosts(params: {
    registryIds: string[];
    species: LivestockSpecies;
    divisionId?: string;
  }): Promise<Map<string, number>> {
    const rows = await getDiseaseIntelligenceRepository().getPrevalenceModifiers(
      params.registryIds,
      params.species,
      params.divisionId,
    );
    const boosts = new Map<string, number>();
    for (const row of rows) {
      const current = boosts.get(row.registryId) ?? 0;
      boosts.set(row.registryId, Math.max(current, BAND_BOOST[row.prevalenceBand]));
    }
    return boosts;
  }

  evaluateContext(params: { species: LivestockSpecies; ageMonths?: number }) {
    return {
      species: params.species,
      ageMonths: params.ageMonths,
      productionStageHint: params.ageMonths !== undefined && params.ageMonths !== null && params.ageMonths < 6 ? 'YOUNG' : 'ADULT',
    };
  }
}

let service: SpeciesIntelligenceService | undefined;

export function getSpeciesIntelligenceService(): SpeciesIntelligenceService {
  service ??= new SpeciesIntelligenceService();
  return service;
}
