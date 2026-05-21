/** Trim, NFC, and collapse whitespace (Unicode-safe for BN/EN). */
export function normalizeLocationName(input: string | null | undefined): string {
  if (input == null) return "";
  return input.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Trim + NFC for official geography codes. Empty → "". */
export function normalizeLocationCode(input: string | null | undefined): string {
  if (input == null) return "";
  return input.normalize("NFC").trim();
}

export function parseBool(s: string | undefined): boolean {
  const t = (s ?? "").trim().toLowerCase();
  if (!t) return false;
  return t === "true" || t === "1" || t === "yes";
}

export function parseNullableNumber(
  raw: string | undefined,
): { n: number | null; invalid: boolean } {
  const t = (raw ?? "").trim();
  if (!t) return { n: null, invalid: false };
  const n = Number(t);
  if (!Number.isFinite(n)) return { n: null, invalid: true };
  return { n, invalid: false };
}

export function validateLatitude(n: number | null): boolean {
  if (n == null) return true;
  return n >= -90 && n <= 90;
}

export function validateLongitude(n: number | null): boolean {
  if (n == null) return true;
  return n >= -180 && n <= 180;
}

export function nonempty(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}
