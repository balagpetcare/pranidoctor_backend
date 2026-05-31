/** Phase 4 coverage minimums (MVC + cross-domain). */
export const UVKG_PHASE4_TARGETS = {
  minEdges: 10_000,
  minEntities: 1_000,
} as const;

export type UvkgCoverageCategory =
  | 'disease_symptom'
  | 'disease_medicine'
  | 'disease_feed_restriction'
  | 'disease_vaccine'
  | 'medicine_contraindication'
  | 'medicine_interaction'
  | 'feed_nutrient'
  | 'feed_disease'
  | 'species_disease'
  | 'region_outbreak';

export const UVKG_COVERAGE_MINIMUMS: Record<
  UvkgCoverageCategory,
  { edgeTypes: string[]; minimum: number }
> = {
  disease_symptom: { edgeTypes: ['HAS_SYMPTOM'], minimum: 120 },
  disease_medicine: { edgeTypes: ['TREATED_WITH', 'CONTRAINDICATES'], minimum: 80 },
  disease_feed_restriction: { edgeTypes: ['CONTRAINDICATES_FEED', 'TOXIC_TO', 'RESTRICTED_FOR'], minimum: 25 },
  disease_vaccine: { edgeTypes: ['REQUIRES_VACCINE', 'PREVENTS'], minimum: 40 },
  medicine_contraindication: { edgeTypes: ['CONTRAINDICATES'], minimum: 25 },
  medicine_interaction: { edgeTypes: ['INTERACTS_WITH'], minimum: 30 },
  feed_nutrient: { edgeTypes: ['NUTRIENT_FOR'], minimum: 15 },
  feed_disease: { edgeTypes: ['CONTRAINDICATES_FEED', 'TOXIC_TO'], minimum: 15 },
  species_disease: { edgeTypes: ['PREVALENT_IN'], minimum: 50 },
  region_outbreak: { edgeTypes: ['OUTBREAK_IN', 'PREVALENT_IN'], minimum: 10 },
};

export const UVKG_BENCHMARK_TARGET_MS = 100;

export const UVKG_TRAVERSAL_PUBLISHED_STATUSES = ['PUBLISHED'] as const;
