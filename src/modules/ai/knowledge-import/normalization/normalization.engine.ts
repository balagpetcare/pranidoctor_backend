import type {
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeContentType,
  VkKnowledgeDomain,
} from '../../../../generated/prisma/index.js';
import { buildSearchText as foundationSearchText } from '../../knowledge-foundation/knowledge-foundation.types.js';
import { inferClinicalRiskTier } from '../../knowledge-ingestion/scoring/evidence-level.engine.js';
import { dedupKeyForExtract } from '../adapters/csv-reference.adapter.js';
import type { NormalizedEntityDraft, RawExtract, SourceFamilyProfile } from '../knowledge-import.types.js';

const CONTENT_TO_DOMAIN: Record<string, VkKnowledgeDomain> = {
  DISEASE: 'DISEASE',
  MEDICINE: 'MEDICINE',
  VACCINE: 'VACCINE',
  FEED: 'FEED',
  FARM_MGMT: 'FARM_MGMT',
  EMERGENCY: 'EMERGENCY',
  BREED: 'BREED',
  REPRODUCTION: 'REPRODUCTION',
  CLINICAL_PROTOCOL: 'CLINICAL_PROTOCOL',
  REGULATORY_BD: 'REGULATORY_BD',
};

const CONTENT_TO_ENTITY_TYPE: Record<string, string> = {
  DISEASE: 'Disease',
  MEDICINE: 'Drug',
  VACCINE: 'Vaccine',
  FEED: 'FeedIngredient',
  FARM_MGMT: 'program',
  EMERGENCY: 'EmergencyCondition',
  BREED: 'Breed',
  REPRODUCTION: 'BreedingProtocol',
  CLINICAL_PROTOCOL: 'SOP',
  REGULATORY_BD: 'DrugRegistration',
};

const DOMAIN_ENTITY_TYPE_DEFAULT: Record<string, string> = {
  BREED: 'Breed',
  REPRODUCTION: 'BreedingProtocol',
  CLINICAL_PROTOCOL: 'SOP',
  REGULATORY_BD: 'DrugRegistration',
};

export class NormalizationEngine {
  readonly name = 'NormalizationEngine';

  normalizeExtract(
    extract: RawExtract,
    profile: SourceFamilyProfile,
    provenance: Record<string, unknown>,
  ): NormalizedEntityDraft {
    const contentType = extract.contentType as AiKnowledgeContentType;
    const domain =
      (extract.domain as VkKnowledgeDomain | undefined) ??
      CONTENT_TO_DOMAIN[contentType] ??
      CONTENT_TO_DOMAIN[extract.domain ?? ''] ??
      'FARM_MGMT';
    const entityType =
      extract.entityType ??
      CONTENT_TO_ENTITY_TYPE[contentType] ??
      DOMAIN_ENTITY_TYPE_DEFAULT[domain] ??
      'entity';

    const inferredRisk = inferClinicalRiskTier(contentType);
    const clinicalRiskTier = maxRiskTier(
      extract.clinicalRiskTier as AiKnowledgeClinicalRiskTier | undefined,
      profile.defaultClinicalRiskTier as AiKnowledgeClinicalRiskTier,
      inferredRisk,
    );

    const localeFlags: string[] = [];
    if (!extract.titleBn.trim() || !extract.bodyBn.trim()) {
      localeFlags.push('BN_PENDING');
    }

    foundationSearchText({
      titleBn: extract.titleBn,
      titleEn: extract.titleEn,
      bodyBn: extract.bodyBn,
      bodyEn: extract.bodyEn,
    });

    return {
      extractIndex: extract.extractIndex,
      entityType,
      domain,
      slug: extract.slug,
      titleBn: extract.titleBn || extract.titleEn,
      titleEn: extract.titleEn,
      bodyBn: extract.bodyBn || extract.bodyEn,
      bodyEn: extract.bodyEn,
      species: extract.species ?? [],
      audience: extract.audience ?? 'FARMER',
      regionScope: extract.regionScope ?? 'BD',
      clinicalRiskTier,
      ...(extract.structuredJson ? { structuredJson: extract.structuredJson } : {}),
      ...(extract.sourceSpanRefs ? { sourceSpanRefs: extract.sourceSpanRefs } : {}),
      ...(extract.summaryBn ? { summaryBn: extract.summaryBn } : {}),
      ...(extract.summaryEn ? { summaryEn: extract.summaryEn } : {}),
      ...(extract.keywordsBn?.length ? { keywordsBn: extract.keywordsBn } : {}),
      ...(extract.keywordsEn?.length ? { keywordsEn: extract.keywordsEn } : {}),
      ...(extract.colloquialBn?.length ? { colloquialBn: extract.colloquialBn } : {}),
      ...(extract.chunkPolicyId ? { chunkPolicyId: extract.chunkPolicyId } : {}),
      localeFlags,
      provenanceJson: {
        ...provenance,
        normalizationVersion: '6b2.0',
        profileKey: profile.profileKey,
        sectionHash: extract.sectionHash,
      },
      dedupKey: dedupKeyForExtract(extract),
    };
  }
}

function maxRiskTier(
  ...tiers: Array<AiKnowledgeClinicalRiskTier | undefined>
): AiKnowledgeClinicalRiskTier {
  const order: AiKnowledgeClinicalRiskTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let max = 'LOW' as AiKnowledgeClinicalRiskTier;
  for (const t of tiers) {
    if (!t) continue;
    if (order.indexOf(t) > order.indexOf(max)) max = t;
  }
  return max;
}

let engine: NormalizationEngine | null = null;

export function getNormalizationEngine(): NormalizationEngine {
  if (!engine) engine = new NormalizationEngine();
  return engine;
}

export function resetNormalizationEngineForTests(): void {
  engine = null;
}
