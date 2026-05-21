import type { PrismaClient } from "@/generated/prisma/client";

/** `Setting.key` for platform commission rate (fraction 0–1, e.g. 0.1 = 10%). */
export const PLATFORM_COMMISSION_SETTING_KEY = "PLATFORM_COMMISSION_RATE";

/** Used when `Setting` row is missing or `valueJson` is invalid. */
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.1;

function isRateInRange(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= 1;
}

/**
 * Parses commission rate from `Setting.valueJson`.
 * Accepts a bare number or `{ "rate": number }` / `{ "value": number }`.
 */
export function parsePlatformCommissionRateFromJson(valueJson: unknown): number | null {
  if (typeof valueJson === "number" && isRateInRange(valueJson)) {
    return valueJson;
  }

  if (valueJson !== null && typeof valueJson === "object" && !Array.isArray(valueJson)) {
    const o = valueJson as Record<string, unknown>;
    const raw = o.rate ?? o.value;
    if (typeof raw === "number" && isRateInRange(raw)) return raw;
    if (typeof raw === "string") {
      const n = Number(raw);
      if (isRateInRange(n)) return n;
    }
  }

  return null;
}

export function resolvePlatformCommissionRate(valueJson: unknown | undefined): number {
  if (valueJson === undefined) return DEFAULT_PLATFORM_COMMISSION_RATE;
  return parsePlatformCommissionRateFromJson(valueJson) ?? DEFAULT_PLATFORM_COMMISSION_RATE;
}

export async function getPlatformCommissionRate(
  db: Pick<PrismaClient, "setting">,
): Promise<number> {
  const row = await db.setting.findUnique({
    where: { key: PLATFORM_COMMISSION_SETTING_KEY },
    select: { valueJson: true },
  });
  return resolvePlatformCommissionRate(row?.valueJson);
}
