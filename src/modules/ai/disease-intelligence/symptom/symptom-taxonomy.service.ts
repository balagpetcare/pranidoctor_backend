import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { ValidationError } from '../../../../shared/errors/http.errors.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';

export class SymptomTaxonomyService {
  readonly name = 'SymptomTaxonomyService';

  async getTaxonomy(species: LivestockSpecies) {
    const rows = await getDiseaseIntelligenceRepository().getSymptomTaxonomyBySpecies(species);
    if (rows.length > 0) {
      const bySystem = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = bySystem.get(row.bodySystem) ?? [];
        list.push(row);
        bySystem.set(row.bodySystem, list);
      }
      return {
        species,
        source: 'die' as const,
        bodySystems: [...bySystem.entries()].map(([bodySystem, symptoms]) => ({
          bodySystem,
          symptoms: symptoms.map((s) => ({
            code: s.code,
            labelBn: s.labelBn,
            labelEn: s.labelEn,
            redFlag: s.redFlag,
          })),
        })),
      };
    }
    return null;
  }

  async search(params: { q?: string; species: LivestockSpecies }) {
    return getDiseaseIntelligenceRepository().searchSymptoms(params);
  }

  async resolveText(params: { phrases: string[]; locale: string; species: LivestockSpecies }) {
    const codes = await getDiseaseIntelligenceRepository().resolveSymptomCodesFromText(
      params.phrases,
      params.locale,
    );
    void getDiseaseAnalyticsService().track('SYMPTOM_RESOLVE', {
      metadata: { phraseCount: params.phrases.length, resolved: codes.length },
    });
    if (codes.length === 0 && params.phrases.some((p) => p.trim().length > 2)) {
      void getDiseaseAnalyticsService().recordCorpusGap({
        queryText: params.phrases.join(' '),
        locale: params.locale,
        species: params.species,
      });
    }
    return { symptomCodes: codes };
  }

  async validateCodes(codes: string[], species: LivestockSpecies) {
    const rows = await getDiseaseIntelligenceRepository().findSymptomsByCodes(codes, species);
    if (rows.length !== codes.length) {
      throw new ValidationError('INVALID_SYMPTOM_CODES', 'One or more symptom codes are invalid for this species');
    }
  }
}

let service: SymptomTaxonomyService | undefined;

export function getSymptomTaxonomyService(): SymptomTaxonomyService {
  service ??= new SymptomTaxonomyService();
  return service;
}
