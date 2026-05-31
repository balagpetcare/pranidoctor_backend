import type { ImportRowInput } from '../../knowledge-ingestion/knowledge-ingestion.types.js';
import {
  dedupKeyForRow,
  normalizeImportRow,
} from '../../knowledge-ingestion/normalization/knowledge-normalizer.js';
import type { RawExtract } from '../knowledge-import.types.js';

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function parseSourceSpanRefs(value: unknown): RawExtract['sourceSpanRefs'] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    if (!item || typeof item !== 'object') return {};
    const ref = item as Record<string, unknown>;
    return {
      ...(typeof ref.page === 'number' ? { page: ref.page } : {}),
      ...(typeof ref.sectionId === 'string' ? { sectionId: ref.sectionId } : {}),
      ...(typeof ref.paragraphIndex === 'number' ? { paragraphIndex: ref.paragraphIndex } : {}),
    };
  });
}

export function parseCsvReferenceRows(rows: Array<Record<string, unknown>>): RawExtract[] {
  const extracts: RawExtract[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    const rowInput: ImportRowInput = {
      slug: String(raw.slug ?? ''),
      contentType: String(raw.contentType ?? raw.domain ?? 'FARM_MGMT') as ImportRowInput['contentType'],
      titleBn: String(raw.titleBn ?? ''),
      titleEn: String(raw.titleEn ?? ''),
      bodyBn: String(raw.bodyBn ?? ''),
      bodyEn: String(raw.bodyEn ?? ''),
    };
    const species = parseStringArray(raw.species);
    if (species?.length) rowInput.species = species;
    if (raw.audience === 'FARMER' || raw.audience === 'DOCTOR' || raw.audience === 'BOTH') {
      rowInput.audience = raw.audience;
    }
    if (
      raw.clinicalRiskTier === 'LOW' ||
      raw.clinicalRiskTier === 'MEDIUM' ||
      raw.clinicalRiskTier === 'HIGH' ||
      raw.clinicalRiskTier === 'CRITICAL'
    ) {
      rowInput.clinicalRiskTier = raw.clinicalRiskTier;
    }
    if (raw.structuredJson && typeof raw.structuredJson === 'object') {
      rowInput.structuredJson = raw.structuredJson as Record<string, unknown>;
    } else if (typeof raw.structuredJson === 'string' && raw.structuredJson.trim()) {
      try {
        rowInput.structuredJson = JSON.parse(raw.structuredJson) as Record<string, unknown>;
      } catch {
        /* validation layer will fail incomplete structuredJson */
      }
    }
    if (raw.sourceSpanRefs) {
      const refs = parseSourceSpanRefs(raw.sourceSpanRefs);
      if (refs) rowInput.sourceSpanRefs = refs;
    }
    if (typeof raw.chunkPolicyId === 'string' && raw.chunkPolicyId.trim()) {
      rowInput.chunkPolicyId = raw.chunkPolicyId.trim();
    }
    const row = normalizeImportRow(rowInput);

    const keywordsBn = parseStringArray(raw.keywordsBn);
    const keywordsEn = parseStringArray(raw.keywordsEn);
    const colloquialBn = parseStringArray(raw.colloquialBn);

    const sectionHash = hashSection(`${row.slug}:${row.bodyEn}:${row.bodyBn}`);
    extracts.push({
      extractIndex: i,
      slug: row.slug,
      contentType: row.contentType,
      titleBn: row.titleBn,
      titleEn: row.titleEn,
      bodyBn: row.bodyBn,
      bodyEn: row.bodyEn,
      ...(row.species?.length ? { species: row.species } : {}),
      ...(row.audience ? { audience: row.audience } : {}),
      ...(row.clinicalRiskTier ? { clinicalRiskTier: row.clinicalRiskTier } : {}),
      ...(row.structuredJson ? { structuredJson: row.structuredJson } : {}),
      ...(row.sourceSpanRefs ? { sourceSpanRefs: row.sourceSpanRefs } : {}),
      ...(typeof raw.domain === 'string' && raw.domain.trim() ? { domain: raw.domain.trim() } : {}),
      ...(typeof raw.entityType === 'string' && raw.entityType.trim()
        ? { entityType: raw.entityType.trim() }
        : {}),
      ...(typeof raw.summaryBn === 'string' ? { summaryBn: raw.summaryBn.trim() } : {}),
      ...(typeof raw.summaryEn === 'string' ? { summaryEn: raw.summaryEn.trim() } : {}),
      ...(keywordsBn?.length ? { keywordsBn } : {}),
      ...(keywordsEn?.length ? { keywordsEn } : {}),
      ...(colloquialBn?.length ? { colloquialBn } : {}),
      ...(row.chunkPolicyId ? { chunkPolicyId: row.chunkPolicyId } : {}),
      ...(typeof raw.regionScope === 'string' && raw.regionScope.trim()
        ? { regionScope: raw.regionScope.trim() }
        : {}),
      sectionHash,
    });
  }

  return extracts;
}

export function dedupKeyForExtract(
  extract: Pick<RawExtract, 'contentType' | 'slug' | 'domain'>,
): string {
  if (extract.domain) {
    return `${extract.domain}:${extract.slug}`;
  }
  return dedupKeyForRow({
    contentType: extract.contentType as ImportRowInput['contentType'],
    slug: extract.slug,
    titleBn: '',
    titleEn: '',
    bodyBn: '',
    bodyEn: '',
  });
}

function hashSection(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}
