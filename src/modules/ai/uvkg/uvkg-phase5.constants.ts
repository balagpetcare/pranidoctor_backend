/** Phase 5 — shadow read validation & rollout thresholds. */
export const UVKG_PHASE5_PARITY_TARGET = 0.95;

export const UVKG_READ_PERCENT_STEPS = [0, 10, 25, 50, 100] as const;

export type UvkgPhase5Feature =
  | 'ai_doctor'
  | 'disease_intelligence'
  | 'medicine_intelligence'
  | 'feed_intelligence'
  | 'prescription_assistant';

export const UVKG_PHASE5_FEATURES: UvkgPhase5Feature[] = [
  'ai_doctor',
  'disease_intelligence',
  'medicine_intelligence',
  'feed_intelligence',
  'prescription_assistant',
];

export const UVKG_PHASE5_PROFILE_BY_FEATURE: Record<UvkgPhase5Feature, string> = {
  ai_doctor: 'ai-doctor-v1',
  disease_intelligence: 'differential-v1',
  medicine_intelligence: 'prescription-v1',
  feed_intelligence: 'feed-advisor-v1',
  prescription_assistant: 'prescription-v1',
};

export const UVKG_PHASE5_ACCURACY_CATEGORIES: Array<{
  key: string;
  label: string;
  edgeTypes: string[];
  refType: string;
  legacyDomain: 'disease' | 'medicine' | 'feed';
}> = [
  { key: 'disease_symptom', label: 'Disease → Symptom', edgeTypes: ['HAS_SYMPTOM'], refType: 'DISEASE', legacyDomain: 'disease' },
  { key: 'disease_medicine', label: 'Disease → Medicine', edgeTypes: ['TREATED_WITH', 'CONTRAINDICATES'], refType: 'DISEASE', legacyDomain: 'disease' },
  { key: 'disease_vaccine', label: 'Disease → Vaccine', edgeTypes: ['REQUIRES_VACCINE', 'PREVENTS'], refType: 'DISEASE', legacyDomain: 'disease' },
  { key: 'medicine_interaction', label: 'Medicine → Interaction', edgeTypes: ['INTERACTS_WITH'], refType: 'MEDICINE_GENERIC', legacyDomain: 'medicine' },
  { key: 'medicine_contraindication', label: 'Medicine → Contraindication', edgeTypes: ['CONTRAINDICATES'], refType: 'MEDICINE_GENERIC', legacyDomain: 'medicine' },
  { key: 'feed_nutrient', label: 'Feed → Nutrient', edgeTypes: ['NUTRIENT_FOR'], refType: 'FEED_INGREDIENT', legacyDomain: 'feed' },
  { key: 'feed_toxicity', label: 'Feed → Toxicity', edgeTypes: ['TOXIC_TO', 'CONTRAINDICATES_FEED'], refType: 'FEED_INGREDIENT', legacyDomain: 'feed' },
  { key: 'species_disease', label: 'Species → Disease', edgeTypes: ['PREVALENT_IN'], refType: 'DISEASE', legacyDomain: 'disease' },
  { key: 'region_outbreak', label: 'Region → Outbreak', edgeTypes: ['OUTBREAK_IN', 'PREVALENT_IN'], refType: 'DISEASE', legacyDomain: 'disease' },
];

export const UVKG_PERFORMANCE_REGRESSION_FACTOR = 1.25;
