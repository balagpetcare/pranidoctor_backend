import type { AreaLevel, AreaLocale, AreaNodeDto } from '../area-engine.types.js';

type DbRow = {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  latitude: unknown;
  longitude: unknown;
  isVerified: boolean;
};

function numFromDecimal(v: unknown): number | null {
  if (v == null) return null;
  if (
    typeof v === 'object' &&
    v !== null &&
    'toNumber' in v &&
    typeof (v as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (v as { toNumber: () => number }).toNumber();
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function labelBn(row: DbRow): string {
  return row.nameBn?.trim() || row.nameEn?.trim() || row.name.trim();
}

function labelEn(row: DbRow): string {
  return row.nameEn?.trim() || row.nameBn?.trim() || row.name.trim();
}

export function pickLabel(row: DbRow, locale: AreaLocale = 'bn'): string {
  return locale === 'en' ? labelEn(row) : labelBn(row);
}

export function mapAreaNode(
  row: DbRow,
  level: AreaLevel,
  parentId: string | null,
  locale: AreaLocale = 'bn',
): AreaNodeDto {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    nameBn: labelBn(row),
    nameEn: labelEn(row),
    label: pickLabel(row, locale),
    level,
    parentId,
    latitude: numFromDecimal(row.latitude),
    longitude: numFromDecimal(row.longitude),
    isVerified: row.isVerified,
  };
}

export function dedupeAreaNodes(rows: AreaNodeDto[]): AreaNodeDto[] {
  const seen = new Set<string>();
  const out: AreaNodeDto[] = [];
  for (const row of rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row);
  }
  return out;
}

export const AREA_SELECT = {
  id: true,
  slug: true,
  code: true,
  name: true,
  nameBn: true,
  nameEn: true,
  latitude: true,
  longitude: true,
  isVerified: true,
} as const;

export const DIVISION_ORDER = [
  { sortOrder: 'asc' as const },
  { nameBn: 'asc' as const },
  { slug: 'asc' as const },
];

export const DEFAULT_CHILD_ORDER = DIVISION_ORDER;

export const VILLAGE_ORDER = [{ nameBn: 'asc' as const }, { slug: 'asc' as const }];
