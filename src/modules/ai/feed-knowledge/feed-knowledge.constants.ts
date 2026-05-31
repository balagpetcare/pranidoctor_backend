import type { AiKnowledgeContentType } from '../../../generated/prisma/index.js';
import type { FeedGraphEdgeType, FeedKnowledgeEntityType, FeedStructuredFactType } from './feed-knowledge.types.js';

export const FEED_KNOWLEDGE_DOMAIN: AiKnowledgeContentType = 'FEED';

export const FEED_ENTITY_TYPES: readonly FeedKnowledgeEntityType[] = [
  'FEED_INGREDIENT',
  'NUTRIENT_REQUIREMENT',
  'RATION_TEMPLATE',
  'TOXIC_FEED_ALERT',
  'FEEDING_GUIDELINE',
  'SEASONAL_CALENDAR',
  'ANTINUTRIENT_LIMIT',
] as const;

export const FEED_GRAPH_EDGE_TYPES: readonly FeedGraphEdgeType[] = [
  'NUTRIENT_FOR',
  'CONTAINS',
  'TOXICITY_OF',
  'ANTINUTRIENT_IN',
  'SEASONAL_AVAILABILITY',
  'SUBSTITUTES_FOR',
  'RESTRICTED_FOR',
] as const;

export const FEED_STRUCTURED_FACT_TYPES: readonly FeedStructuredFactType[] = [
  'NUTRIENT_CP_PERCENT',
  'NUTRIENT_TDN_PERCENT',
  'NUTRIENT_DM_INTAKE_KG',
  'NUTRIENT_ME_MJ_PER_KG',
  'NUTRIENT_NDF_MAX',
  'NUTRIENT_CA_MIN',
  'NUTRIENT_P_MIN',
  'INGREDIENT_COMPOSITION',
  'INGREDIENT_PRICE_BDT',
  'INGREDIENT_MAX_INCLUSION',
  'TOXIC_THRESHOLD',
  'FORMULATION_COST',
] as const;

export const FEED_ADVISOR_RETRIEVAL_PROFILE = 'feed-advisor-v1';
export const FEED_ADVISOR_TASK_TYPE = 'FEED_FORMULATION' as const;
export const FEED_ADVISOR_FEATURE = 'feed_advisor';

export const FEED_KNOWLEDGE_MIN_CONFIDENCE = 0.55;
export const FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL = 'L2';

export const FEED_TOXIC_FAIL_CLOSED = true;
export const FEED_TOXIC_VET_APPROVAL_REQUIRED = true;

export const FEED_FORMULATION_MAX_INGREDIENTS = 15;
export const FEED_FORMULATION_DEFAULT_DM_BASIS = true;

export const FEED_DEFAULT_REGION_CODE = 'BD';
export const FEED_DEFAULT_LOCALE = 'bn';

export const FEED_INGREDIENT_GOVERNANCE_POLICY = {
  lowRisk: ['FEEDING_GUIDELINE', 'SEASONAL_CALENDAR'],
  mediumRisk: ['FEED_INGREDIENT', 'NUTRIENT_REQUIREMENT', 'RATION_TEMPLATE'],
  highRisk: ['TOXIC_FEED_ALERT', 'ANTINUTRIENT_LIMIT'],
  vetApprovalRequired: ['TOXIC_FEED_ALERT', 'ANTINUTRIENT_LIMIT'],
} as const;

export const FEED_INGREDIENT_RE_REVIEW_INTERVALS: Record<FeedKnowledgeEntityType, number> = {
  FEED_INGREDIENT: 730,
  NUTRIENT_REQUIREMENT: 548,
  RATION_TEMPLATE: 365,
  TOXIC_FEED_ALERT: 365,
  FEEDING_GUIDELINE: 365,
  SEASONAL_CALENDAR: 180,
  ANTINUTRIENT_LIMIT: 365,
};

export const BD_FEED_CATEGORIES = {
  roughage: { labelBn: 'ঘাসপাতা ও ভুষি', labelEn: 'Roughage & Fodder' },
  concentrate: { labelBn: 'দানাদার খাদ্য', labelEn: 'Concentrates' },
  green: { labelBn: 'সবুজ খাদ্য', labelEn: 'Green Fodder' },
  silage: { labelBn: 'সাইলেজ', labelEn: 'Silage' },
  supplement: { labelBn: 'সম্পূরক খাদ্য', labelEn: 'Supplements' },
  mineral: { labelBn: 'খনিজ মিশ্রণ', labelEn: 'Mineral Mix' },
  byproduct: { labelBn: 'উপজাত', labelEn: 'By-products' },
} as const;

export const FEED_GROUNDING_INSTRUCTION_BN = `আপনি বাংলাদেশের পশুপালকদের জন্য একজন খাদ্য পরামর্শদাতা সহকারী।

গ্রাউন্ডিং নিয়ম:
১. শুধুমাত্র নিচের Reference, Structured Facts এবং Evidence বিভাগ ব্যবহার করুন।
২. পুষ্টি চাহিদার জন্য শুধুমাত্র Structured Facts JSON ব্যবহার করুন।
৩. যদি Structured Facts-এ প্রয়োজনীয় পুষ্টি না থাকে, পশু পুষ্টিবিদের সাথে পরামর্শ করতে বলুন।
৪. কখনই খাদ্য উপাদান বা পুষ্টি মান বানিয়ে বলবেন না।
৫. প্রতিটি পুষ্টি দাবির পরে ইনলাইন সাইটেশন টোকেন দিন।
৬. উপাদান সীমাবদ্ধতা এবং বিষক্রিয়া সতর্কতা মেনে চলুন।
৭. সমস্ত ফর্মুলেশন শিক্ষামূলক - কৃষককে স্থানীয় বিশেষজ্ঞের সাথে যাচাই করতে বলুন।`;

export const FEED_GROUNDING_INSTRUCTION_EN = `You are a feed advisor assistant for Bangladesh livestock farmers.

GROUNDING RULES:
1. Use ONLY the Reference, Structured Facts, and Evidence sections below.
2. For nutrient requirements, use ONLY Structured Facts JSON.
3. If Structured Facts do not contain required nutrients, recommend consulting a nutritionist.
4. NEVER invent feed compositions or nutrient values.
5. Cite inline tokens after each nutritional claim.
6. Respect ingredient restrictions and toxic alerts.
7. All formulations are EDUCATIONAL - farmer should verify with local expert.`;

export const FEED_DISCLAIMER_BN = `⚠️ এই খাদ্য পরামর্শ শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে। চূড়ান্ত সিদ্ধান্ত নেওয়ার আগে স্থানীয় পশু পুষ্টিবিদ বা অভিজ্ঞ খামারির সাথে পরামর্শ করুন।`;

export const FEED_DISCLAIMER_EN = `⚠️ This feed advice is for educational purposes only. Consult a local animal nutritionist or experienced farmer before making final decisions.`;

export const FEED_TOXIC_WARNING_BN = `🚨 বিপদ: বিষাক্ত উপাদান সনাক্ত হয়েছে। এখনই পশু চিকিৎসকের সাথে যোগাযোগ করুন।`;
export const FEED_TOXIC_WARNING_EN = `🚨 DANGER: Toxic substance detected. Contact a veterinarian immediately.`;
