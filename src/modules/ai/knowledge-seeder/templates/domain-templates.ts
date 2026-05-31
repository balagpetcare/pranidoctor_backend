import type { DomainTemplateDefinition, SeederDomain } from '../knowledge-seeder.types.js';

const BASE_CSV_HEADERS = [
  'slug',
  'domain',
  'entityType',
  'titleBn',
  'titleEn',
  'summaryBn',
  'summaryEn',
  'bodyBn',
  'bodyEn',
  'species',
  'audience',
  'regionScope',
  'clinicalRiskTier',
  'chunkPolicyId',
  'keywordsBn',
  'keywordsEn',
  'colloquialBn',
  'structuredJson',
  'sourceSpanRefs',
] as const;

export const DOMAIN_TEMPLATE_REGISTRY: Record<SeederDomain, DomainTemplateDefinition> = {
  DISEASE: {
    domain: 'DISEASE',
    schemaFile: 'disease.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'Disease',
    defaultChunkPolicyId: 'DISEASE_BY_HEADING',
    defaultClinicalRiskTier: 'MEDIUM',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['diseaseCode'],
  },
  MEDICINE: {
    domain: 'MEDICINE',
    schemaFile: 'medicine.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'Drug',
    defaultChunkPolicyId: 'MEDICINE_BY_SECTION',
    defaultClinicalRiskTier: 'HIGH',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['genericName'],
  },
  VACCINE: {
    domain: 'VACCINE',
    schemaFile: 'vaccine.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'Vaccine',
    defaultChunkPolicyId: 'VACCINE_BY_SCHEDULE_ROW',
    defaultClinicalRiskTier: 'HIGH',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['antigen'],
  },
  FEED: {
    domain: 'FEED',
    schemaFile: 'feed.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'FeedIngredient',
    defaultChunkPolicyId: 'FEED_BY_NUTRIENT_BLOCK',
    defaultClinicalRiskTier: 'LOW',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['ingredientCode'],
  },
  BREED: {
    domain: 'BREED',
    schemaFile: 'breed.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'Breed',
    defaultChunkPolicyId: 'GENERIC_BY_PARAGRAPH',
    defaultClinicalRiskTier: 'LOW',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['breedCode', 'species'],
  },
  REPRODUCTION: {
    domain: 'REPRODUCTION',
    schemaFile: 'reproduction.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'BreedingProtocol',
    defaultChunkPolicyId: 'GENERIC_BY_PARAGRAPH',
    defaultClinicalRiskTier: 'MEDIUM',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
  },
  EMERGENCY: {
    domain: 'EMERGENCY',
    schemaFile: 'emergency.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'EmergencyCondition',
    defaultChunkPolicyId: 'EMERGENCY_BY_ACTION',
    defaultClinicalRiskTier: 'CRITICAL',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['vetRequiredWithinHours'],
  },
  CLINICAL_PROTOCOL: {
    domain: 'CLINICAL_PROTOCOL',
    schemaFile: 'clinical-protocol.template.schema.json',
    csvHeaders: [...BASE_CSV_HEADERS],
    defaultEntityType: 'SOP',
    defaultChunkPolicyId: 'PROTOCOL_BY_STEP',
    defaultClinicalRiskTier: 'HIGH',
    requiredFields: ['slug', 'domain', 'titleBn', 'titleEn', 'bodyBn', 'bodyEn'],
    requiredBnFields: ['titleBn', 'bodyBn'],
    structuredJsonRequiredKeys: ['procedureCode'],
  },
};

export function getDomainTemplate(domain: SeederDomain): DomainTemplateDefinition {
  return DOMAIN_TEMPLATE_REGISTRY[domain];
}

export function listDomainTemplates(): DomainTemplateDefinition[] {
  return Object.values(DOMAIN_TEMPLATE_REGISTRY);
}

export function resolveSeederDomain(value: string): SeederDomain | null {
  const upper = value.trim().toUpperCase();
  if (upper in DOMAIN_TEMPLATE_REGISTRY) {
    return upper as SeederDomain;
  }
  return null;
}

export const KNOWLEDGE_IMPORT_CSV_HEADERS = BASE_CSV_HEADERS.join(',');
