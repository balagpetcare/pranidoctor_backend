import type { FormulationWarning } from './formulation-types.js';

export const FEED_FORMULATION_WARNINGS = {
  INFEASIBLE_SOLUTION: {
    code: 'INFEASIBLE_SOLUTION',
    severity: 'warning' as const,
    messageBn: 'প্রদত্ত শর্ত সহ সর্বোত্তম সমাধান পাওয়া যায়নি',
    messageEn: 'Optimal solution not found with given constraints',
  },
  NO_ROUGHAGE: {
    code: 'NO_ROUGHAGE',
    severity: 'warning' as const,
    messageBn: 'কোনো আঁশ জাতীয় খাদ্য পাওয়া যায়নি',
    messageEn: 'No roughage ingredients available',
  },
  NO_CONCENTRATE: {
    code: 'NO_CONCENTRATE',
    severity: 'warning' as const,
    messageBn: 'কোনো দানাদার খাদ্য পাওয়া যায়নি',
    messageEn: 'No concentrate ingredients available',
  },
  LOW_PROTEIN_SOURCES: {
    code: 'LOW_PROTEIN_SOURCES',
    severity: 'warning' as const,
    messageBn: 'প্রোটিন সমৃদ্ধ উপাদান কম',
    messageEn: 'Limited high-protein ingredients available',
  },
  BUDGET_TOO_LOW: {
    code: 'BUDGET_TOO_LOW',
    severity: 'warning' as const,
    messageBn: 'বাজেট উপাদানের দামের চেয়ে কম',
    messageEn: 'Budget may be too low for available ingredients',
  },
  ANTINUTRIENT_RISK: {
    code: 'ANTINUTRIENT_RISK',
    severity: 'warning' as const,
    messageBn: 'কিছু উপাদানে অ্যান্টিনিউট্রিয়েন্ট আছে',
    messageEn: 'Some ingredients contain antinutrients',
  },
  SEASONAL_AVAILABILITY: {
    code: 'SEASONAL_AVAILABILITY',
    severity: 'info' as const,
    messageBn: 'কিছু উপাদান মৌসুমী',
    messageEn: 'Some ingredients are seasonal',
  },
} as const satisfies Record<string, FormulationWarning>;

export const FORMULATION_EXPLANATIONS = {
  FALLBACK_BN: 'সর্বোত্তম ফর্মুলা গণনা করা সম্ভব হয়নি। একটি বিকল্প মিশ্রণ প্রস্তাব করা হলো।',
  FALLBACK_EN: 'Unable to compute optimal formula. An alternative mixture is proposed.',
  SUCCESS_BN: 'সর্বনিম্ন খরচে পুষ্টি চাহিদা পূরণকারী খাদ্য মিশ্রণ তৈরি করা হয়েছে।',
  SUCCESS_EN: 'Ration formulated to meet nutrient requirements at minimum cost.',
} as const;

export const FORMULATION_LIMITS = {
  MAX_INGREDIENTS_PER_FORMULA: 15,
  MIN_INGREDIENTS_PER_FORMULA: 2,
  MAX_ITERATIONS: 1000,
  CONVERGENCE_THRESHOLD: 0.001,
  DEFAULT_BATCH_SIZE_KG: 100,
  MIN_INCLUSION_THRESHOLD_PERCENT: 0.1,
} as const;

export const INGREDIENT_CATEGORIES = {
  ROUGHAGE: ['FODDER_GREEN', 'FODDER_DRY', 'STRAW', 'SILAGE', 'HAY'],
  CONCENTRATE: ['CEREAL', 'OILSEED_MEAL', 'BRAN', 'GRAIN_BYPRODUCT'],
  SUPPLEMENT: ['MINERAL_MIX', 'VITAMIN_PREMIX', 'SALT', 'ADDITIVE'],
  BYPRODUCT: ['AGRO_BYPRODUCT', 'INDUSTRIAL_BYPRODUCT'],
} as const;

export const NUTRIENT_PRIORITIES = {
  CRITICAL: ['CP', 'TDN', 'ME'],
  IMPORTANT: ['NDF', 'Ca', 'P'],
  OPTIONAL: ['CF', 'ADF', 'EE'],
} as const;
