/**
 * Helpers for location CSV validation, normalization, and coordinate checks.
 * Used by `scripts/import-locations.ts` and can be reused by admin tooling.
 *
 * Row shapes:
 * - **Union (hierarchy CSV):** `validateUnionCsvHierarchyRow`
 * - **Village:** `validateLocationCsvRow`
 */

/** Trim and collapse internal whitespace (Unicode-safe for BN/EN). */
export function normalizeLocationName(input: string | null | undefined): string {
  if (input == null) return "";
  return input
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

/** Trim + NFC for official geography codes (BBS / union codes). Empty → "". */
export function normalizeLocationCode(input: string | null | undefined): string {
  if (input == null) return "";
  return input.normalize("NFC").trim();
}

export function parseNullableCoordinate(
  raw: string | null | undefined,
): { value: number | null; error: string | null } {
  const t = (raw ?? "").trim();
  if (!t) return { value: null, error: null };
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return { value: null, error: "not_a_number" };
  }
  return { value: n, error: null };
}

export function validateLatitude(n: number | null): boolean {
  if (n == null) return true;
  return n >= -90 && n <= 90;
}

export function validateLongitude(n: number | null): boolean {
  if (n == null) return true;
  return n >= -180 && n <= 180;
}

export function isLikelyDuplicateLocationName(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeLocationName(a).toLowerCase();
  const nb = normalizeLocationName(b).toLowerCase();
  if (!na || !nb) return false;
  return na === nb;
}

export type UnionCsvRowCheck = {
  ok: boolean;
  errors: string[];
  divisionCode: string | null;
  districtCode: string | null;
  upazilaCode: string | null;
  unionCode: string | null;
  nameEn: string | null;
  nameBn: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  isVerified: boolean;
};

/** New-format union row: division_code,district_code,upazila_code,union_code,name_en,name_bn,lat,lng,source,is_verified */
export function validateUnionCsvHierarchyRow(cells: string[]): UnionCsvRowCheck {
  const errors: string[] = [];
  const divisionCode = cells[0]?.trim() || null;
  const districtCode = cells[1]?.trim() || null;
  const upazilaCode = cells[2]?.trim() || null;
  const unionCode = cells[3]?.trim() || null;
  const nameEn = cells[4]?.trim() || null;
  const nameBn = cells[5]?.trim() || null;
  const source = cells[8]?.trim() || null;
  const isVerified = ["true", "1", "yes"].includes(
    (cells[9] ?? "").trim().toLowerCase(),
  );

  if (!divisionCode) errors.push("missing_division_code");
  if (!districtCode) errors.push("missing_district_code");
  if (!upazilaCode) errors.push("missing_upazila_code");
  if (!unionCode) errors.push("missing_union_code");
  if (!nameEn && !nameBn) errors.push("missing_name_en_and_bn");
  if (!source) errors.push("missing_source");

  const latP = parseNullableCoordinate(cells[6]);
  const lngP = parseNullableCoordinate(cells[7]);
  if (latP.error) errors.push("invalid_lat_parse");
  if (lngP.error) errors.push("invalid_lng_parse");
  let lat = latP.value;
  let lng = lngP.value;
  if (lat != null && !validateLatitude(lat)) {
    errors.push("lat_out_of_range");
    lat = null;
  }
  if (lng != null && !validateLongitude(lng)) {
    errors.push("lng_out_of_range");
    lng = null;
  }

  return {
    ok: errors.length === 0,
    errors,
    divisionCode,
    districtCode,
    upazilaCode,
    unionCode,
    nameEn,
    nameBn,
    lat,
    lng,
    source,
    isVerified,
  };
}

export type VillageCsvRowCheck = {
  ok: boolean;
  errors: string[];
  divisionCode: string | null;
  districtCode: string | null;
  upazilaCode: string | null;
  unionCode: string | null;
  villageCode: string | null;
  nameEn: string | null;
  nameBn: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  isVerified: boolean;
};

/** Village row: division_code,district_code,upazila_code,union_code,village_code,name_en,name_bn,lat,lng,source,is_verified */
export function validateLocationCsvRow(cells: string[]): VillageCsvRowCheck {
  const errors: string[] = [];
  const divisionCode = cells[0]?.trim() || null;
  const districtCode = cells[1]?.trim() || null;
  const upazilaCode = cells[2]?.trim() || null;
  const unionCode = cells[3]?.trim() || null;
  const villageCode = cells[4]?.trim() || null;
  const nameEn = cells[5]?.trim() || null;
  const nameBn = cells[6]?.trim() || null;
  const source = cells[9]?.trim() || null;
  const isVerified = ["true", "1", "yes"].includes(
    (cells[10] ?? "").trim().toLowerCase(),
  );

  if (!divisionCode) errors.push("missing_division_code");
  if (!districtCode) errors.push("missing_district_code");
  if (!upazilaCode) errors.push("missing_upazila_code");
  if (!unionCode) errors.push("missing_union_code");
  if (!nameBn) errors.push("missing_name_bn");
  if (!source) errors.push("missing_source");

  const latP = parseNullableCoordinate(cells[7]);
  const lngP = parseNullableCoordinate(cells[8]);
  if (latP.error) errors.push("invalid_lat_parse");
  if (lngP.error) errors.push("invalid_lng_parse");
  let lat = latP.value;
  let lng = lngP.value;
  if (lat != null && !validateLatitude(lat)) {
    errors.push("lat_out_of_range");
    lat = null;
  }
  if (lng != null && !validateLongitude(lng)) {
    errors.push("lng_out_of_range");
    lng = null;
  }

  return {
    ok: errors.length === 0,
    errors,
    divisionCode,
    districtCode,
    upazilaCode,
    unionCode,
    villageCode,
    nameEn,
    nameBn,
    lat,
    lng,
    source,
    isVerified,
  };
}
