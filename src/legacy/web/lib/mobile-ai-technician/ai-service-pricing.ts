/**
 * Technician-controlled AI service pricing (pure module — no database access).
 *
 *   totalCustomerPrice = semenPrice + aiServiceCharge
 *
 * `AiTechnicianService.basePrice` keeps meaning "customer price"; when the split is used,
 * `basePrice` is always derived from it, so every existing reader (farmer listing, booking
 * estimate) keeps working unchanged. Money is handled as integer paisa (BigInt) to avoid
 * floating point drift.
 */

export type MoneyInput = number | string | null | undefined;

export type PricingErrorCode =
  | "INVALID_PRICE"
  | "PRICE_INCOMPLETE"
  | "PRICE_MISMATCH"
  | "PRICE_REQUIRED";

export type ResolvedPricing =
  | {
      ok: true;
      /** Customer price (before any offer / discount). Decimal string with 2 places. */
      basePrice: string;
      /** Null when the technician used the legacy single-price form. */
      semenPrice: string | null;
      aiServiceCharge: string | null;
    }
  | { ok: false; code: PricingErrorCode };

export const PRICING_ERROR_MESSAGES_BN: Record<PricingErrorCode, string> = {
  INVALID_PRICE: "মূল্য সঠিক নয় (সর্বোচ্চ ২ দশমিক ঘর)",
  PRICE_INCOMPLETE: "সিমেন মূল্য ও এআই সার্ভিস চার্জ দুটোই দিন",
  PRICE_MISMATCH: "মোট মূল্য সিমেন মূল্য ও সার্ভিস চার্জের যোগফলের সমান হতে হবে",
  PRICE_REQUIRED: "মূল্য দিন (০ এর বেশি হতে হবে)",
};

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

function isBlank(v: MoneyInput): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Parses a non-negative amount with at most 2 decimals into paisa. Returns null if invalid. */
export function parseMoneyToPaisa(v: MoneyInput): bigint | null {
  if (isBlank(v)) return null;
  const s = (typeof v === "number" ? String(v) : String(v).trim()).trim();
  if (!Number.isFinite(Number(s)) || !MONEY_RE.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}

export function formatPaisa(p: bigint): string {
  const whole = p / 100n;
  const frac = (p % 100n).toString().padStart(2, "0");
  return `${whole.toString()}.${frac}`;
}

/** Sum used for display and storage: `computeTotalCustomerPrice(500, 300) === "800.00"`. */
export function computeTotalCustomerPrice(
  semenPrice: MoneyInput,
  aiServiceCharge: MoneyInput,
): string | null {
  const s = parseMoneyToPaisa(semenPrice);
  const c = parseMoneyToPaisa(aiServiceCharge);
  if (s === null || c === null) return null;
  return formatPaisa(s + c);
}

export type ResolveServicePricingInput = {
  semenPrice?: MoneyInput;
  aiServiceCharge?: MoneyInput;
  basePrice?: MoneyInput;
};

export type ResolveServicePricingOptions = {
  /** Used by the legacy single-price path when `basePrice` is not supplied (e.g. template default). */
  fallbackBasePrice?: MoneyInput;
  /** True when the result must be > 0 (catalog templates ship with no price on purpose). */
  requirePositive?: boolean;
};

export function resolveServicePricing(
  input: ResolveServicePricingInput,
  options: ResolveServicePricingOptions = {},
): ResolvedPricing {
  const hasSemen = !isBlank(input.semenPrice);
  const hasCharge = !isBlank(input.aiServiceCharge);
  const hasBase = !isBlank(input.basePrice);

  let basePaisa: bigint;
  let semen: bigint | null = null;
  let charge: bigint | null = null;

  if (hasSemen || hasCharge) {
    if (!(hasSemen && hasCharge)) return { ok: false, code: "PRICE_INCOMPLETE" };
    semen = parseMoneyToPaisa(input.semenPrice);
    charge = parseMoneyToPaisa(input.aiServiceCharge);
    if (semen === null || charge === null) return { ok: false, code: "INVALID_PRICE" };
    basePaisa = semen + charge;
    if (hasBase) {
      const given = parseMoneyToPaisa(input.basePrice);
      if (given === null) return { ok: false, code: "INVALID_PRICE" };
      if (given !== basePaisa) return { ok: false, code: "PRICE_MISMATCH" };
    }
  } else {
    const raw = hasBase ? input.basePrice : options.fallbackBasePrice;
    const parsed = parseMoneyToPaisa(raw);
    if (parsed === null) {
      return { ok: false, code: isBlank(raw) ? "PRICE_REQUIRED" : "INVALID_PRICE" };
    }
    basePaisa = parsed;
  }

  if (options.requirePositive && basePaisa <= 0n) {
    return { ok: false, code: "PRICE_REQUIRED" };
  }

  return {
    ok: true,
    basePrice: formatPaisa(basePaisa),
    semenPrice: semen === null ? null : formatPaisa(semen),
    aiServiceCharge: charge === null ? null : formatPaisa(charge),
  };
}
