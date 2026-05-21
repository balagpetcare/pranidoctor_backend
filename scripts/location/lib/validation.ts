import {
  normalizeLocationCode,
  normalizeLocationName,
  parseBool,
  parseNullableNumber,
  validateLatitude,
  validateLongitude,
} from "./normalize.js";

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

export function validateUnionCsvHierarchyRow(cells: string[]): UnionCsvRowCheck {
  const errors: string[] = [];
  const divisionCode = cells[0]?.trim() || null;
  const districtCode = cells[1]?.trim() || null;
  const upazilaCode = cells[2]?.trim() || null;
  const unionCode = cells[3]?.trim() || null;
  const nameEn = cells[4]?.trim() || null;
  const nameBn = cells[5]?.trim() || null;
  const latP = parseNullableNumber(cells[6]);
  const lngP = parseNullableNumber(cells[7]);
  const source = cells[8]?.trim() || null;
  const isVerified = parseBool(cells[9]);

  if (!divisionCode) errors.push("missing division_code");
  if (!districtCode) errors.push("missing district_code");
  if (!upazilaCode) errors.push("missing upazila_code");
  if (!unionCode) errors.push("missing union_code");
  if (!nameEn && !nameBn) errors.push("missing name_en and name_bn");

  let lat = latP.n;
  let lng = lngP.n;
  if (latP.invalid) errors.push("invalid lat");
  if (lngP.invalid) errors.push("invalid lng");
  if (lat != null && !validateLatitude(lat)) errors.push("lat out of range");
  if (lng != null && !validateLongitude(lng)) errors.push("lng out of range");

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

export function isHierarchyUnionHeader(header: string): boolean {
  const h = header.toLowerCase();
  return h.includes("division_code") && h.includes("upazila_code");
}

/** Dedupe key: parent scope + normalized display name (EN preferred). */
export function parentNameKey(
  parentId: string,
  nameEn: string | null,
  nameBn: string | null,
): string {
  const label = normalizeLocationName(nameEn || nameBn || "");
  return `${parentId}|${label.toLowerCase()}`;
}
