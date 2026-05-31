import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { resolveStructuredRecord } from '../../knowledge-retrieval/search/lexical-scoring.util.js';
import { scoreTextMatch } from '../../knowledge-retrieval/search/lexical-scoring.util.js';

export type InlineCitation = {
  token: string;
  entityId: string;
  slug: string;
  sourceKey: string;
  evidenceLevel: string;
};

export type MedicineStructuredJson = {
  genericName?: string;
  drugClass?: string;
  prescriptionRequired?: boolean;
  brandNamesBd?: string[];
  routes?: string[];
  contraindications?: Array<string | { condition?: string; severity?: string; descriptionBn?: string; descriptionEn?: string }>;
  interactsWith?: Array<{
    targetSlug?: string;
    slug?: string;
    severity?: string;
    mechanismBn?: string;
    mechanismEn?: string;
  }>;
  vaccineInteractions?: Array<{
    vaccineSlug?: string;
    conflictType?: string;
    severity?: string;
    windowBn?: string;
    windowEn?: string;
  }>;
  speciesDoseMatrix?: Array<{
    species?: string;
    ageMinDays?: number;
    ageMaxDays?: number;
    doseMgPerKg?: number;
    doseMlPerKg?: number;
    withdrawalDays?: number;
    withdrawalMilkDays?: number;
    withdrawalMeatDays?: number;
    route?: string;
  }>;
  withdrawalDays?: number;
  withdrawalMilkDays?: number;
  withdrawalMeatDays?: number;
  doseMgKg?: number;
  doseMlKg?: number;
  bannedSubstance?: boolean;
  registrationStatus?: string;
  antimicrobialClass?: string;
};

export type PublishedMedicineEntry = {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  species: LivestockSpecies[];
  confidenceScore: number;
  evidenceLevel: string;
  metadataJson: unknown;
  sourceKey?: string;
};

export function parseMedicineStructured(metadataJson: unknown): MedicineStructuredJson {
  const record = resolveStructuredRecord(metadataJson);
  if (!record) return {};
  return record as MedicineStructuredJson;
}

export function buildMedicineCitation(entry: PublishedMedicineEntry): InlineCitation {
  return {
    token: `[cite:${entry.slug}]`,
    entityId: entry.id,
    slug: entry.slug,
    sourceKey: entry.sourceKey ?? entry.slug,
    evidenceLevel: entry.evidenceLevel,
  };
}

export function scoreMedicineQueryMatch(entry: PublishedMedicineEntry, query: string): number {
  const structured = parseMedicineStructured(entry.metadataJson);
  const generic = structured.genericName ?? '';
  const brands = (structured.brandNamesBd ?? []).join(' ');
  const titleScore = Math.max(
    scoreTextMatch(entry.titleBn, query),
    scoreTextMatch(entry.titleEn, query),
    scoreTextMatch(generic, query),
    scoreTextMatch(brands, query),
    scoreTextMatch(entry.slug.replace(/-/g, ' '), query),
  );
  const base = entry.confidenceScore ?? 0.5;
  return Math.min(1, titleScore * 0.75 + base * 0.25);
}

export function isAntimicrobialClass(drugClass?: string, antimicrobialClass?: string): boolean {
  const combined = `${drugClass ?? ''} ${antimicrobialClass ?? ''}`.toLowerCase();
  return /antibiotic|antimicrobial|antibacterial|antiparasitic/.test(combined);
}

export function normalizeInteractionSeverity(
  raw?: string,
): 'MILD' | 'MODERATE' | 'SEVERE' | 'CONTRAINDICATED' {
  const s = (raw ?? 'MODERATE').toUpperCase();
  if (s.includes('CONTRA') || s === 'SEVERE') return s.includes('CONTRA') ? 'CONTRAINDICATED' : 'SEVERE';
  if (s === 'MILD') return 'MILD';
  if (s === 'MODERATE') return 'MODERATE';
  return 'MODERATE';
}

export function severityToRiskLevel(
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CONTRAINDICATED',
): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  switch (severity) {
    case 'MILD':
      return 'LOW';
    case 'MODERATE':
      return 'MODERATE';
    case 'SEVERE':
      return 'HIGH';
    case 'CONTRAINDICATED':
      return 'CRITICAL';
    default:
      return 'MODERATE';
  }
}
