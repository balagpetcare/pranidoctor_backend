import type { SourceFamilyProfile } from '../knowledge-import.types.js';

export const SOURCE_FAMILY_PROFILES: SourceFamilyProfile[] = [
  {
    profileKey: 'vet-book-pdf-v1',
    sourceFamily: 'VETERINARY_BOOK',
    sourceClasses: ['VETERINARY_TEXTBOOK'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['PDF', 'CSV'],
    allowedDomains: ['DISEASE', 'MEDICINE', 'CLINICAL_PROTOCOL'],
    defaultClinicalRiskTier: 'HIGH',
    requiresVetByDefault: true,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'clinical-guideline-v1',
    sourceFamily: 'CLINICAL_GUIDELINE',
    sourceClasses: ['CLINICAL_PROTOCOL'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['PDF', 'DOCX', 'CSV'],
    allowedDomains: ['CLINICAL_PROTOCOL', 'EMERGENCY'],
    defaultClinicalRiskTier: 'HIGH',
    requiresVetByDefault: true,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'bpa-wpa-v1',
    sourceFamily: 'BPA_WPA_DOCUMENT',
    sourceClasses: ['BPA_GUIDELINE', 'WPA_GUIDELINE'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['HTML', 'PDF', 'CSV'],
    allowedDomains: ['DISEASE', 'VACCINE', 'FARM_MGMT'],
    defaultClinicalRiskTier: 'MEDIUM',
    requiresVetByDefault: false,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'govt-livestock-v1',
    sourceFamily: 'GOVT_LIVESTOCK_MANUAL',
    sourceClasses: ['GOVT_LIVESTOCK'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['PDF', 'HTML', 'CSV'],
    allowedDomains: ['FARM_MGMT', 'REGULATORY_BD', 'VACCINE'],
    defaultClinicalRiskTier: 'MEDIUM',
    requiresVetByDefault: false,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'medicine-ref-v1',
    sourceFamily: 'MEDICINE_REFERENCE',
    sourceClasses: ['MEDICINE_REFERENCE'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['CSV', 'JSON'],
    allowedDomains: ['MEDICINE', 'REGULATORY_BD'],
    defaultClinicalRiskTier: 'CRITICAL',
    requiresVetByDefault: true,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'vaccine-ref-v1',
    sourceFamily: 'VACCINE_REFERENCE',
    sourceClasses: ['VACCINE_SCHEDULE'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['CSV', 'JSON'],
    allowedDomains: ['VACCINE'],
    defaultClinicalRiskTier: 'HIGH',
    requiresVetByDefault: true,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'feed-ref-v1',
    sourceFamily: 'FEED_REFERENCE',
    sourceClasses: ['FEED_REFERENCE'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['CSV', 'JSON'],
    allowedDomains: ['FEED'],
    defaultClinicalRiskTier: 'LOW',
    requiresVetByDefault: false,
    dedupKeyFields: ['contentType', 'slug'],
  },
  {
    profileKey: 'population-bundle-v1',
    sourceFamily: 'GOVT_LIVESTOCK_MANUAL',
    sourceClasses: ['KNOWLEDGE_POPULATION'],
    adapterId: 'csv-reference-v2',
    allowedMediaTypes: ['CSV', 'JSON'],
    allowedDomains: [
      'DISEASE',
      'MEDICINE',
      'VACCINE',
      'FEED',
      'BREED',
      'REPRODUCTION',
      'EMERGENCY',
      'CLINICAL_PROTOCOL',
      'REGULATORY_BD',
      'FARM_MGMT',
    ],
    defaultClinicalRiskTier: 'MEDIUM',
    requiresVetByDefault: false,
    dedupKeyFields: ['domain', 'slug'],
  },
];

export function resolveProfileForSourceClass(sourceClass: string): SourceFamilyProfile {
  const profile = SOURCE_FAMILY_PROFILES.find((p) => p.sourceClasses.includes(sourceClass));
  if (!profile) {
    return SOURCE_FAMILY_PROFILES[0]!;
  }
  return profile;
}

export function getProfileByKey(profileKey: string): SourceFamilyProfile | undefined {
  return SOURCE_FAMILY_PROFILES.find((p) => p.profileKey === profileKey);
}
