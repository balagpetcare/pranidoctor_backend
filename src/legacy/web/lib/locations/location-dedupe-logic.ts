/**
 * Shared identity keys and canonical-row selection for location dedupe reports/scripts.
 */
import {
  normalizeLocationCode,
  normalizeLocationName,
} from "./location-data-quality.js";

export type LocationDedupeBase = {
  id: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  slug: string;
  createdAt: Date;
};

export function displayEnglishLabel(row: {
  name: string;
  nameBn: string | null;
  nameEn: string | null;
}): string {
  return (
    normalizeLocationName(row.nameEn) ||
    normalizeLocationName(row.nameBn) ||
    normalizeLocationName(row.name)
  );
}

/** Division: code + normalized label (avoids merging unrelated rows that share a wrong code). */
export function divisionIdentityKey(row: LocationDedupeBase): string {
  const c = normalizeLocationCode(row.code);
  const nameKey = normalizeLocationName(displayEnglishLabel(row)).toLowerCase();
  if (c.length > 0) return `c:${c}|n:${nameKey}`;
  return `n:${nameKey}`;
}

export function districtIdentityKey(
  row: LocationDedupeBase & { divisionId: string },
): string {
  const c = normalizeLocationCode(row.code);
  const nameKey = normalizeLocationName(displayEnglishLabel(row)).toLowerCase();
  if (c.length > 0) return `${row.divisionId}|c:${c}|n:${nameKey}`;
  return `${row.divisionId}|n:${nameKey}`;
}

export function upazilaIdentityKey(
  row: LocationDedupeBase & { districtId: string },
): string {
  const c = normalizeLocationCode(row.code);
  const nameKey = normalizeLocationName(displayEnglishLabel(row)).toLowerCase();
  if (c.length > 0) return `${row.districtId}|c:${c}|n:${nameKey}`;
  return `${row.districtId}|n:${nameKey}`;
}

export function unionIdentityKey(
  row: LocationDedupeBase & { upazilaId: string },
): string {
  const c = normalizeLocationCode(row.code);
  const nameKey = normalizeLocationName(displayEnglishLabel(row)).toLowerCase();
  if (c.length > 0) return `${row.upazilaId}|c:${c}|n:${nameKey}`;
  return `${row.upazilaId}|n:${nameKey}`;
}

export function villageIdentityKey(
  row: LocationDedupeBase & { unionId: string },
): string {
  const c = normalizeLocationCode(row.code);
  const bn = normalizeLocationName(row.nameBn);
  const en = normalizeLocationName(row.nameEn);
  const label = (bn || en || normalizeLocationName(row.name)).toLowerCase();
  if (c.length > 0) return `${row.unionId}|c:${c}|n:${label}`;
  return `${row.unionId}|n:${label}`;
}

/** Matches partial unique index `Division_code_trim_uidx` (trimmed code, non-empty). */
export function divisionTrimCodeKey(row: LocationDedupeBase): string | null {
  const c = normalizeLocationCode(row.code);
  return c.length > 0 ? `tc:${c}` : null;
}

/** Matches `District_division_code_trim_uidx`. */
export function districtTrimCodeKey(
  row: LocationDedupeBase & { divisionId: string },
): string | null {
  const c = normalizeLocationCode(row.code);
  return c.length > 0 ? `${row.divisionId}|tc:${c}` : null;
}

/** Matches `Upazila_district_code_trim_uidx`. */
export function upazilaTrimCodeKey(
  row: LocationDedupeBase & { districtId: string },
): string | null {
  const c = normalizeLocationCode(row.code);
  return c.length > 0 ? `${row.districtId}|tc:${c}` : null;
}

/** Matches `Union_upazila_code_trim_uidx`. */
export function unionTrimCodeKey(
  row: LocationDedupeBase & { upazilaId: string },
): string | null {
  const c = normalizeLocationCode(row.code);
  return c.length > 0 ? `${row.upazilaId}|tc:${c}` : null;
}

/** Matches `Village_union_code_trim_uidx`. */
export function villageTrimCodeKey(
  row: LocationDedupeBase & { unionId: string },
): string | null {
  const c = normalizeLocationCode(row.code);
  return c.length > 0 ? `${row.unionId}|tc:${c}` : null;
}

/** True when all rows share the same normalized English display label (empty allowed as one bucket). */
export function sameNormalizedEnglishLabelAcross(rows: LocationDedupeBase[]): boolean {
  const labels = new Set(
    rows.map((r) => normalizeLocationName(displayEnglishLabel(r)).toLowerCase()),
  );
  return labels.size <= 1;
}

export type TrimCodeDuplicateGroup<T extends LocationDedupeBase = LocationDedupeBase> = {
  /** Key aligned with partial unique index (parent + trimmed code, or global trim code for Division). */
  trimKey: string;
  count: number;
  /** When false, `npm run locations:dedupe -- --apply` will skip this group (manual fix required). */
  safeForAutoMerge: boolean;
  distinctNormalizedLabels: string[];
  rowIds: string[];
  /** Present in memory for scripts; reports may omit heavy fields when serializing. */
  rows: T[];
};

/** Groups rows that share the same non-empty trimmed official code under the same parent (Division: global). */
export function trimCodeDuplicateGroups<T extends LocationDedupeBase>(
  rows: T[],
  trimKeyFn: (row: T) => string | null,
): TrimCodeDuplicateGroup<T>[] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = trimKeyFn(r);
    if (k == null) continue;
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  const out: TrimCodeDuplicateGroup<T>[] = [];
  for (const [trimKey, list] of m) {
    if (list.length < 2) continue;
    const distinctNormalizedLabels = [
      ...new Set(
        list.map((r) => normalizeLocationName(displayEnglishLabel(r)).toLowerCase()),
      ),
    ].sort();
    out.push({
      trimKey,
      count: list.length,
      safeForAutoMerge: sameNormalizedEnglishLabelAcross(list),
      distinctNormalizedLabels,
      rowIds: list.map((r) => r.id),
      rows: list,
    });
  }
  out.sort((a, b) => b.count - a.count || a.trimKey.localeCompare(b.trimKey));
  return out;
}

/** Prefer official code, then oldest createdAt, then lowest id (lexicographic). */
export function pickCanonicalLocationRow<T extends LocationDedupeBase>(rows: T[]): T {
  if (rows.length === 0) {
    throw new Error("pickCanonicalLocationRow: empty rows");
  }
  return [...rows].sort((a, b) => {
    const ac = normalizeLocationCode(a.code).length > 0 ? 1 : 0;
    const bc = normalizeLocationCode(b.code).length > 0 ? 1 : 0;
    if (ac !== bc) return bc - ac;
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  })[0]!;
}

function mobileListDedupeKey(row: {
  code: string | null;
  nameEn: string;
  nameBn: string;
}): string {
  const c = normalizeLocationCode(row.code);
  const en = normalizeLocationName(row.nameEn);
  const bn = normalizeLocationName(row.nameBn);
  const label = (en || bn).toLowerCase();
  if (c.length > 0) return `c:${c}|n:${label}`;
  return `n:${label}`;
}

/**
 * Drop rows that would show duplicate labels under the same parent context
 * (API already scopes by parent; this removes same code or same EN/BN display).
 */
export function dedupeMobileLocationRows<
  T extends { code: string | null; nameEn: string; nameBn: string },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = mobileListDedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
