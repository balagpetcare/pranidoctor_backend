import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

import type { SeederBundleRow } from '../knowledge-seeder.types.js';
import { getDomainTemplate } from '../templates/domain-templates.js';
import { resolveSeederDomain } from '../templates/domain-templates.js';

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

function parseJsonField(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return undefined;
}

function parseSourceSpanRefs(value: unknown): SeederBundleRow['sourceSpanRefs'] | undefined {
  if (typeof value === 'string' && value.trim()) {
    const parsed = JSON.parse(value);
    return parseSourceSpanRefs(parsed);
  }
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

function rowFromRecord(raw: Record<string, unknown>, rowIndex: number): SeederBundleRow {
  const domainRaw = String(raw.domain ?? raw.contentType ?? '').trim();
  const domain = resolveSeederDomain(domainRaw);
  if (!domain) {
    throw new Error(`Row ${rowIndex}: invalid domain "${domainRaw}"`);
  }

  let structuredJson: Record<string, unknown> | undefined;
  if (raw.structuredJson != null) {
    structuredJson = parseJsonField(raw.structuredJson);
  }

  let sourceSpanRefs: SeederBundleRow['sourceSpanRefs'];
  if (raw.sourceSpanRefs != null) {
    sourceSpanRefs = parseSourceSpanRefs(raw.sourceSpanRefs);
  }

  const audience =
    raw.audience === 'FARMER' || raw.audience === 'DOCTOR' || raw.audience === 'BOTH'
      ? raw.audience
      : undefined;

  const clinicalRiskTier =
    raw.clinicalRiskTier === 'LOW' ||
    raw.clinicalRiskTier === 'MEDIUM' ||
    raw.clinicalRiskTier === 'HIGH' ||
    raw.clinicalRiskTier === 'CRITICAL'
      ? raw.clinicalRiskTier
      : undefined;

  const species = parseStringArray(raw.species);
  const keywordsBn = parseStringArray(raw.keywordsBn);
  const keywordsEn = parseStringArray(raw.keywordsEn);
  const colloquialBn = parseStringArray(raw.colloquialBn);

  return {
    slug: String(raw.slug ?? '').trim(),
    domain,
    ...(typeof raw.entityType === 'string' && raw.entityType.trim()
      ? { entityType: raw.entityType.trim() }
      : {}),
    ...(typeof raw.contentType === 'string' ? { contentType: raw.contentType.trim() } : {}),
    titleBn: String(raw.titleBn ?? '').trim(),
    titleEn: String(raw.titleEn ?? '').trim(),
    ...(typeof raw.summaryBn === 'string' ? { summaryBn: raw.summaryBn.trim() } : {}),
    ...(typeof raw.summaryEn === 'string' ? { summaryEn: raw.summaryEn.trim() } : {}),
    bodyBn: String(raw.bodyBn ?? '').trim(),
    bodyEn: String(raw.bodyEn ?? '').trim(),
    ...(species?.length ? { species } : {}),
    ...(audience ? { audience } : {}),
    ...(typeof raw.regionScope === 'string' ? { regionScope: raw.regionScope.trim() } : {}),
    ...(clinicalRiskTier ? { clinicalRiskTier } : {}),
    ...(typeof raw.chunkPolicyId === 'string' ? { chunkPolicyId: raw.chunkPolicyId.trim() } : {}),
    ...(keywordsBn?.length ? { keywordsBn } : {}),
    ...(keywordsEn?.length ? { keywordsEn } : {}),
    ...(colloquialBn?.length ? { colloquialBn } : {}),
    ...(structuredJson ? { structuredJson } : {}),
    ...(sourceSpanRefs?.length ? { sourceSpanRefs } : {}),
  };
}

function parseCsvContent(content: string): Array<Record<string, unknown>> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!);
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]!);
    const record: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]!] = values[j] ?? '';
    }
    rows.push(record);
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result.map((v) => v.trim());
}

export function loadBundleFile(filePath: string): SeederBundleRow[] {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.json' && ext !== '.csv') {
    throw new Error(`Unsupported bundle format: ${ext || '(none)'}. Use .csv or .json`);
  }

  const content = readFileSync(filePath, 'utf8');

  if (ext === '.json') {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => rowFromRecord(item as Record<string, unknown>, index));
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown[] }).rows)) {
      return (parsed as { rows: Record<string, unknown>[] }).rows.map((item, index) =>
        rowFromRecord(item, index),
      );
    }
    throw new Error('JSON bundle must be an array or { rows: [] } object');
  }

  if (ext === '.csv') {
    const records = parseCsvContent(content);
    return records.map((record, index) => rowFromRecord(record, index));
  }

  throw new Error(`Unsupported bundle format: ${ext}. Use .csv or .json`);
}

export function seederRowToImportRecord(row: SeederBundleRow): Record<string, unknown> {
  const template = getDomainTemplate(row.domain);
  const entityType = row.entityType ?? template.defaultEntityType;
  const chunkPolicyId = row.chunkPolicyId ?? template.defaultChunkPolicyId;
  const clinicalRiskTier = row.clinicalRiskTier ?? template.defaultClinicalRiskTier;

  return {
    slug: row.slug,
    domain: row.domain,
    contentType: row.contentType ?? row.domain,
    entityType,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    ...(row.summaryBn ? { summaryBn: row.summaryBn } : {}),
    ...(row.summaryEn ? { summaryEn: row.summaryEn } : {}),
    bodyBn: row.bodyBn,
    bodyEn: row.bodyEn,
    ...(row.species?.length ? { species: row.species } : {}),
    ...(row.audience ? { audience: row.audience } : {}),
    regionScope: row.regionScope ?? 'BD',
    clinicalRiskTier,
    chunkPolicyId,
    ...(row.keywordsBn?.length ? { keywordsBn: row.keywordsBn } : {}),
    ...(row.keywordsEn?.length ? { keywordsEn: row.keywordsEn } : {}),
    ...(row.colloquialBn?.length ? { colloquialBn: row.colloquialBn } : {}),
    ...(row.structuredJson ? { structuredJson: row.structuredJson } : {}),
    ...(row.sourceSpanRefs?.length ? { sourceSpanRefs: row.sourceSpanRefs } : {}),
  };
}

export function rowsToImportRecords(rows: SeederBundleRow[]): Array<Record<string, unknown>> {
  return rows.map(seederRowToImportRecord);
}
