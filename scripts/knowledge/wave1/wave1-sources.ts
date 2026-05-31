import { getKnowledgeFoundationService } from '../../../src/modules/ai/knowledge-foundation/knowledge-foundation.service.js';
import { getKnowledgeSourceRepository } from '../../../src/modules/ai/knowledge-foundation/repositories/knowledge-source.repository.js';
import { getPrisma } from '../../../src/shared/database/prisma.js';
import type { AiKnowledgeContentType } from '../../../src/generated/prisma/index.js';

export type Wave1SourceKey =
  | 'dls-livestock-manual-v1'
  | 'dls-vaccination-calendar-bd'
  | 'bvc-clinical-protocols'
  | 'bau-vet-medicine-handbook'
  | 'bpa-biosecurity-guide'
  | 'bau-feed-composition-bd';

const WAVE1_SOURCES: Array<{
  sourceKey: Wave1SourceKey;
  titleBn: string;
  titleEn: string;
  publisher: string;
  trustTier: number;
  sourceClass: 'GOVT_LIVESTOCK' | 'VACCINE_SCHEDULE' | 'CLINICAL_PROTOCOL' | 'VETERINARY_TEXTBOOK' | 'BPA_GUIDELINE' | 'FEED_REFERENCE';
  allowedDomains: AiKnowledgeContentType[];
}> = [
  {
    sourceKey: 'dls-livestock-manual-v1',
    titleBn: 'DLS Livestock Manual',
    titleEn: 'DLS Livestock Manual',
    publisher: 'Department of Livestock Services',
    trustTier: 2,
    sourceClass: 'GOVT_LIVESTOCK',
    allowedDomains: ['DISEASE', 'VACCINE', 'EMERGENCY', 'FEED'],
  },
  {
    sourceKey: 'dls-vaccination-calendar-bd',
    titleBn: 'DLS Vaccination Calendar BD',
    titleEn: 'DLS Vaccination Calendar BD',
    publisher: 'DLS',
    trustTier: 2,
    sourceClass: 'VACCINE_SCHEDULE',
    allowedDomains: ['VACCINE'],
  },
  {
    sourceKey: 'bvc-clinical-protocols',
    titleBn: 'BVC Clinical Protocols',
    titleEn: 'BVC Clinical Protocols',
    publisher: 'Bangladesh Veterinary Council',
    trustTier: 2,
    sourceClass: 'CLINICAL_PROTOCOL',
    allowedDomains: ['EMERGENCY', 'FARM_MGMT', 'DISEASE'],
  },
  {
    sourceKey: 'bau-vet-medicine-handbook',
    titleBn: 'BAU Veterinary Medicine Handbook',
    titleEn: 'BAU Veterinary Medicine Handbook',
    publisher: 'Bangladesh Agricultural University',
    trustTier: 2,
    sourceClass: 'VETERINARY_TEXTBOOK',
    allowedDomains: ['DISEASE', 'MEDICINE'],
  },
  {
    sourceKey: 'bpa-biosecurity-guide',
    titleBn: 'BPA Biosecurity Guide',
    titleEn: 'BPA Biosecurity Guide',
    publisher: 'Bangladesh Poultry Association',
    trustTier: 2,
    sourceClass: 'BPA_GUIDELINE',
    allowedDomains: ['FARM_MGMT', 'DISEASE'],
  },
  {
    sourceKey: 'bau-feed-composition-bd',
    titleBn: 'BAU Feed Composition BD',
    titleEn: 'BAU Feed Composition BD',
    publisher: 'BAU',
    trustTier: 2,
    sourceClass: 'FEED_REFERENCE',
    allowedDomains: ['FEED'],
  },
];

export async function ensureWave1Sources(): Promise<Record<Wave1SourceKey, string>> {
  const foundation = getKnowledgeFoundationService();
  const repo = getKnowledgeSourceRepository();
  const ids = {} as Record<Wave1SourceKey, string>;

  for (const def of WAVE1_SOURCES) {
    const existing = await repo.findByKey(def.sourceKey);
    if (existing) {
      ids[def.sourceKey] = existing.id;
      continue;
    }

    const license = await getPrisma().aiKnowledgeSourceLicense.create({
      data: {
        licenseType: 'GOVT_OPEN',
        allowsAiExtraction: true,
        allowsFarmerDistribution: true,
        allowsVerbatimQuote: false,
        rightsNote: `Wave 1 MVC seed license for ${def.sourceKey}`,
      },
    });

    const created = await foundation.createSource(
      {
        sourceKey: def.sourceKey,
        sourceClass: def.sourceClass,
        sourceType: 'GOVT_EXTENSION',
        titleBn: def.titleBn,
        titleEn: def.titleEn,
        publisher: def.publisher,
        jurisdiction: 'BD',
        trustTier: def.trustTier,
        allowedDomains: def.allowedDomains,
        licenseId: license.id,
      },
      { id: 'wave1-mvc-deploy', role: 'KNOWLEDGE_SEEDER' },
    );

    ids[def.sourceKey] = created.id;
  }

  return ids;
}

export function sourceIdForDomain(
  domain: string,
  sourceIds: Record<Wave1SourceKey, string>,
): string {
  switch (domain) {
    case 'VACCINE':
      return sourceIds['dls-vaccination-calendar-bd'];
    case 'EMERGENCY':
      return sourceIds['bvc-clinical-protocols'];
    case 'FEED':
      return sourceIds['bau-feed-composition-bd'];
    case 'DISEASE':
      return sourceIds['bau-vet-medicine-handbook'];
    case 'CLINICAL_PROTOCOL':
      return sourceIds['bvc-clinical-protocols'];
    default:
      return sourceIds['dls-livestock-manual-v1'];
  }
}
