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

export type VaccineStructuredJson = {
  antigen?: string;
  manufacturer?: string;
  route?: string;
  doseMl?: number;
  storageTempC?: number;
  boosterIntervalDays?: number;
  ageWindow?: string;
  ageMinDays?: number;
  ageMaxDays?: number;
  vaccineIntervals?: Array<{
    targetSlug?: string;
    minDaysBetween?: number;
    severity?: string;
    noteBn?: string;
    noteEn?: string;
  }>;
  medicineInteractions?: Array<{
    medicineSlug?: string;
    conflictType?: string;
    severity?: string;
    windowBn?: string;
    windowEn?: string;
  }>;
};

export type PublishedVaccineEntry = {
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
  entityType: string;
  sourceKey?: string;
};

export function parseVaccineStructured(metadataJson: unknown): VaccineStructuredJson {
  const record = resolveStructuredRecord(metadataJson);
  if (!record) return {};
  const nested =
    typeof record.structuredJson === 'object' && record.structuredJson !== null
      ? (record.structuredJson as VaccineStructuredJson)
      : record;
  return nested as VaccineStructuredJson;
}

export function resolveEntityType(metadataJson: unknown, slug: string): string {
  if (metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)) {
    const root = metadataJson as Record<string, unknown>;
    if (typeof root.entityType === 'string' && root.entityType.trim()) {
      return root.entityType;
    }
  }
  const record = resolveStructuredRecord(metadataJson);
  const fromMeta =
    typeof record?.entityType === 'string' ? record.entityType : undefined;
  if (fromMeta) return fromMeta;
  if (slug.includes('-schedule') || slug.endsWith('-calendar')) return 'VaccinationSchedule';
  if (slug.includes('cold-chain')) return 'ColdChainRule';
  return 'Vaccine';
}

export function buildVaccineCitation(entry: PublishedVaccineEntry): InlineCitation {
  return {
    token: `[cite:${entry.slug}]`,
    entityId: entry.id,
    slug: entry.slug,
    sourceKey: entry.sourceKey ?? entry.slug,
    evidenceLevel: entry.evidenceLevel,
  };
}

export function scoreVaccineQueryMatch(entry: PublishedVaccineEntry, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const structured = parseVaccineStructured(entry.metadataJson);
  const antigen = structured.antigen?.toLowerCase() ?? '';
  if (entry.slug.includes(q) || entry.slug.replace(/-/g, ' ').includes(q)) return 0.95;
  if (antigen && (q.includes(antigen) || antigen.includes(q))) return 0.9;
  return Math.max(
    scoreTextMatch(entry.titleBn, q),
    scoreTextMatch(entry.titleEn, q),
    scoreTextMatch(entry.bodyBn, q),
    scoreTextMatch(entry.bodyEn, q),
  );
}

const BN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeBnDigits(text: string): string {
  return text.replace(/[০-৯]/g, (ch) => BN_DIGITS[ch] ?? ch);
}

/** Parse Bangla/English age window strings into approximate day bounds. */
export function parseAgeWindowDays(ageWindow?: string, structured?: VaccineStructuredJson): {
  minDays?: number;
  maxDays?: number;
} {
  if (structured?.ageMinDays !== undefined || structured?.ageMaxDays !== undefined) {
    return {
      ...(structured.ageMinDays !== undefined ? { minDays: structured.ageMinDays } : {}),
      ...(structured.ageMaxDays !== undefined ? { maxDays: structured.ageMaxDays } : {}),
    };
  }
  if (!ageWindow) return {};
  const normalized = normalizeBnDigits(ageWindow);
  const monthMatch = normalized.match(/(\d+)\s*[–-]\s*(\d+)\s*মাস/);
  if (monthMatch) {
    return {
      minDays: Number(monthMatch[1]) * 30,
      maxDays: Number(monthMatch[2]) * 30,
    };
  }
  const singleMonth = normalized.match(/(\d+)\s*মাস/);
  if (singleMonth) {
    const days = Number(singleMonth[1]) * 30;
    return { minDays: days - 15, maxDays: days + 15 };
  }
  const enRange = ageWindow.match(/(\d+)\s*[–-]\s*(\d+)\s*months?/i);
  if (enRange) {
    return {
      minDays: Number(enRange[1]) * 30,
      maxDays: Number(enRange[2]) * 30,
    };
  }
  return {};
}
