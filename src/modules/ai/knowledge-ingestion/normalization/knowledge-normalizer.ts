import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import type { ImportRowInput } from '../knowledge-ingestion.types.js';

const SPECIES_ALIASES: Record<string, LivestockSpecies> = {
  cow: 'COW',
  cattle: 'COW',
  goat: 'GOAT',
  sheep: 'SHEEP',
  chicken: 'CHICKEN',
  poultry: 'CHICKEN',
  duck: 'DUCK',
  buffalo: 'BUFFALO',
  horse: 'HORSE',
  goru: 'COW',
  chagol: 'GOAT',
  murgi: 'CHICKEN',
};

export function normalizeSpeciesList(raw?: string[]): LivestockSpecies[] {
  if (!raw?.length) return [];
  const out = new Set<LivestockSpecies>();
  for (const item of raw) {
    const key = item.trim().toLowerCase();
    const mapped = SPECIES_ALIASES[key];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

export function buildSearchText(row: Pick<ImportRowInput, 'titleBn' | 'titleEn' | 'bodyBn' | 'bodyEn'>): string {
  return `${row.titleBn} ${row.titleEn} ${row.bodyBn} ${row.bodyEn}`.toLowerCase();
}

export function normalizeImportRow(row: ImportRowInput): ImportRowInput {
  return {
    ...row,
    slug: row.slug.trim().toLowerCase().replace(/\s+/g, '-'),
    titleBn: row.titleBn.trim(),
    titleEn: row.titleEn.trim(),
    bodyBn: row.bodyBn.trim(),
    bodyEn: row.bodyEn.trim(),
    species: normalizeSpeciesList(row.species),
  };
}

export function dedupKeyForRow(row: ImportRowInput): string {
  return `${row.contentType}:${row.slug}`;
}
