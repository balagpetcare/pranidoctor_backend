import type { VkKnowledgeEdgeClass } from '../../../generated/prisma/index.js';
import type { FeedGraphEdgeType } from '../feed-knowledge/feed-knowledge.types.js';
import type { MedicineGraphEdgeType } from '../medicine/knowledge/medicine-knowledge.repository.js';

export type MappedEdge = {
  uvkgEdgeType: string;
  edgeClass: VkKnowledgeEdgeClass;
};

const FEED_EDGE_MAP: Record<FeedGraphEdgeType, MappedEdge> = {
  NUTRIENT_FOR: { uvkgEdgeType: 'NUTRIENT_FOR', edgeClass: 'NUTRITIONAL' },
  CONTAINS: { uvkgEdgeType: 'CONTAINS', edgeClass: 'NUTRITIONAL' },
  TOXICITY_OF: { uvkgEdgeType: 'TOXIC_TO', edgeClass: 'CLINICAL' },
  ANTINUTRIENT_IN: { uvkgEdgeType: 'ANTINUTRIENT_IN', edgeClass: 'NUTRITIONAL' },
  SEASONAL_AVAILABILITY: { uvkgEdgeType: 'SEASONAL_AVAILABILITY', edgeClass: 'NUTRITIONAL' },
  SUBSTITUTES_FOR: { uvkgEdgeType: 'SUBSTITUTES_INGREDIENT', edgeClass: 'NUTRITIONAL' },
  RESTRICTED_FOR: { uvkgEdgeType: 'RESTRICTED_FOR', edgeClass: 'NUTRITIONAL' },
};

const MEDICINE_EDGE_MAP: Record<MedicineGraphEdgeType, MappedEdge> = {
  BRAND_OF_GENERIC: { uvkgEdgeType: 'BRAND_OF', edgeClass: 'METADATA' },
  MANUFACTURED_BY: { uvkgEdgeType: 'MANUFACTURED_BY', edgeClass: 'METADATA' },
  SPONSORED_BY: { uvkgEdgeType: 'SPONSORED_BY', edgeClass: 'COMMERCIAL' },
  SUBSTITUTES_FOR: { uvkgEdgeType: 'SUBSTITUTES_FOR', edgeClass: 'CLINICAL' },
  CONTRAINDICATED_WITH: { uvkgEdgeType: 'CONTRAINDICATES', edgeClass: 'CLINICAL' },
  INTERACTS_WITH: { uvkgEdgeType: 'INTERACTS_WITH', edgeClass: 'CLINICAL' },
  SAME_THERAPEUTIC_CLASS: { uvkgEdgeType: 'SAME_THERAPEUTIC_CLASS', edgeClass: 'METADATA' },
  SAME_DRUG_CLASS: { uvkgEdgeType: 'SAME_DRUG_CLASS', edgeClass: 'METADATA' },
};

const DISEASE_EDGE_MAP: Record<string, MappedEdge> = {
  HAS_SYMPTOM: { uvkgEdgeType: 'HAS_SYMPTOM', edgeClass: 'CLINICAL' },
  DIFFERENTIAL_OF: { uvkgEdgeType: 'DIFFERENTIAL_OF', edgeClass: 'CLINICAL' },
  SUGGESTS_PROTOCOL: { uvkgEdgeType: 'SUGGESTS_PROTOCOL', edgeClass: 'CLINICAL' },
  CONTRAINDICATES_MEDICINE: { uvkgEdgeType: 'CONTRAINDICATES', edgeClass: 'CLINICAL' },
  REQUIRES_VACCINE: { uvkgEdgeType: 'REQUIRES_VACCINE', edgeClass: 'CLINICAL' },
  ESCALATES_TO_EMERGENCY: { uvkgEdgeType: 'ESCALATES_TO', edgeClass: 'CLINICAL' },
  COMORBID_WITH: { uvkgEdgeType: 'COMORBID_WITH', edgeClass: 'CLINICAL' },
};

export function mapFeedEdgeType(edgeType: string): MappedEdge {
  return FEED_EDGE_MAP[edgeType as FeedGraphEdgeType] ?? {
    uvkgEdgeType: edgeType,
    edgeClass: 'NUTRITIONAL',
  };
}

export function mapMedicineEdgeType(edgeType: string): MappedEdge {
  return MEDICINE_EDGE_MAP[edgeType as MedicineGraphEdgeType] ?? {
    uvkgEdgeType: edgeType,
    edgeClass: 'CLINICAL',
  };
}

export function mapDiseaseEdgeType(edgeType: string): MappedEdge {
  return DISEASE_EDGE_MAP[edgeType] ?? { uvkgEdgeType: edgeType, edgeClass: 'CLINICAL' };
}

/** Clinical traversal must never follow commercial edges. */
export const CLINICAL_TRAVERSAL_EDGE_CLASSES: VkKnowledgeEdgeClass[] = [
  'CLINICAL',
  'NUTRITIONAL',
  'REGULATORY',
  'METADATA',
];

export const PROFILE_EDGE_ALLOWLIST: Record<string, string[]> = {
  'differential-v1': ['HAS_SYMPTOM', 'DIFFERENTIAL_OF', 'ESCALATES_TO'],
  'prescription-v1': ['CONTRAINDICATES', 'INTERACTS_WITH', 'WITHDRAWAL_FOR', 'TREATED_WITH'],
  'feed-advisor-v1': ['TOXIC_TO', 'RESTRICTED_FOR', 'NUTRIENT_FOR', 'CONTAINS', 'CONTRAINDICATES_FEED'],
  'ai-doctor-v1': ['HAS_SYMPTOM', 'DIFFERENTIAL_OF', 'ESCALATES_TO', 'COMORBID_WITH', 'SUGGESTS_PROTOCOL'],
};
