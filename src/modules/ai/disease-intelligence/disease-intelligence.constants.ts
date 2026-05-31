export const DISEASE_INTELLIGENCE_FEATURE = 'disease_reasoning';

export const DIE_MODEL_VERSION = 'die-v1';

export const DIE_DEFAULT_SAFETY_POLICY_VERSION = 'die-v1';

export const DIE_RETRIEVAL_PROFILES = {
  DISEASE: 'disease-v1',
  DIFFERENTIAL: 'differential-v1',
  OUTBREAK: 'outbreak-v1',
  AI_DOCTOR: 'ai-doctor-v1',
} as const;

export const DIE_GRAPH_EDGE_TYPES = {
  HAS_SYMPTOM: 'HAS_SYMPTOM',
  DIFFERENTIAL_OF: 'DIFFERENTIAL_OF',
  SUGGESTS_PROTOCOL: 'SUGGESTS_PROTOCOL',
  CONTRAINDICATES_MEDICINE: 'CONTRAINDICATES_MEDICINE',
  ESCALATES_TO_EMERGENCY: 'ESCALATES_TO_EMERGENCY',
} as const;

export const DIE_FUSION_WEIGHTS = {
  graph: 0.35,
  retrieval: 0.4,
  prevalence: 0.15,
  outbreak: 0.1,
} as const;

export const DIE_MAX_DIFFERENTIALS_FARMER = 5;
export const DIE_MAX_DIFFERENTIALS_PARAVET = 8;
export const DIE_MAX_DIFFERENTIALS_VET = 15;

export const DIE_DISCLAIMER_BN =
  'এটি চিকিৎসা নির্ণয় নয়। সম্ভাব্য কারণ শুধুমাত্র যাচাইকৃত সূত্র থেকে দেখানো হয়েছে। চিকিৎসার পরামর্শের জন্য লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের সাথে যোগাযোগ করুন।';

export const DIE_DISCLAIMER_EN =
  'This is not a diagnosis. Possible causes are shown from verified sources only. Contact a licensed veterinarian for treatment advice.';
