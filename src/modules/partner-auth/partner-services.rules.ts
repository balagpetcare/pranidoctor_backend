import { grantedServiceRoles, type PartnerRole } from './partner-roles.js';

export type ServiceMode =
  | 'ONLINE_CONSULTATION'
  | 'HOME_VISIT'
  | 'CLINIC_VISIT'
  | 'EMERGENCY'
  | 'FIELD_SERVICE';

export type CatalogLite = {
  providerKinds: string[];
  species: string[];
  minPriceBdt: number | null;
  maxPriceBdt: number | null;
  isActive: boolean;
};

/** Species a partner may offer services for: doctors follow their approved tracks, others the field species. */
export function allowedSpeciesFor(
  role: PartnerRole,
  activeTrackSpecies: readonly string[],
): string[] {
  if (role === 'DOCTOR') return [...activeTrackSpecies];
  return ['cattle_goat', 'poultry_duck'];
}

/** Whether the partner's role (incl. inherited services) and tracks can use a catalog item. */
export function catalogUsable(item: CatalogLite, role: PartnerRole, allowedSpecies: readonly string[]): boolean {
  if (!item.isActive) return false;
  const kinds = grantedServiceRoles(role) as string[];
  if (!item.providerKinds.some((k) => kinds.includes(k))) return false;
  return item.species.some((s) => allowedSpecies.includes(s));
}

/** Species an offering created from `item` will carry. */
export function offeringSpeciesFromCatalog(item: CatalogLite, allowedSpecies: readonly string[]): string[] {
  return item.species.filter((s) => allowedSpecies.includes(s));
}

export type PriceCheck = { ok: true } | { ok: false; message: string };

export function checkPrice(item: Pick<CatalogLite, 'minPriceBdt' | 'maxPriceBdt'>, price: number): PriceCheck {
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: 'দাম সঠিক নয়।' };
  if (item.minPriceBdt !== null && price < item.minPriceBdt) {
    return { ok: false, message: `সর্বনিম্ন দাম ${item.minPriceBdt} টাকা।` };
  }
  if (item.maxPriceBdt !== null && price > item.maxPriceBdt) {
    return { ok: false, message: `সর্বোচ্চ দাম ${item.maxPriceBdt} টাকা।` };
  }
  return { ok: true };
}

/** Custom services may only target species the partner is approved for. */
export function customSpeciesAllowed(
  species: readonly string[],
  allowedSpecies: readonly string[],
): PriceCheck {
  if (species.length === 0) return { ok: false, message: 'কোন প্রাণীর জন্য সেবা তা বেছে নিন।' };
  const bad = species.filter((s) => !allowedSpecies.includes(s));
  if (bad.length > 0) return { ok: false, message: 'যে প্রাণীর জন্য আপনি অনুমোদিত নন, তার সেবা যোগ করা যাবে না।' };
  return { ok: true };
}

export const FEE_MAX_BDT = 100000;

export type FeeInput = {
  onlineFeeBdt?: number | null | undefined;
  emergencyFeeBdt?: number | null | undefined;
  visitFeeBdt?: number | null | undefined;
  acceptsOnlineConsultation?: boolean | undefined;
  acceptsEmergency?: boolean | undefined;
};

/** A switched-on channel needs a fee; fees stay within sane bounds. */
export function checkFees(current: FeeInput, patch: FeeInput): PriceCheck {
  const merged = { ...current, ...patch };
  for (const key of ['onlineFeeBdt', 'emergencyFeeBdt', 'visitFeeBdt'] as const) {
    const v = merged[key];
    if (v !== null && v !== undefined && (!Number.isFinite(v) || v < 0 || v > FEE_MAX_BDT)) {
      return { ok: false, message: `ফি ০ থেকে ${FEE_MAX_BDT} টাকার মধ্যে দিন।` };
    }
  }
  if (merged.acceptsOnlineConsultation && !(merged.onlineFeeBdt && merged.onlineFeeBdt > 0)) {
    return { ok: false, message: 'অনলাইন কনসালটেশন চালু করতে তার ফি দিন।' };
  }
  if (merged.acceptsEmergency && !(merged.emergencyFeeBdt && merged.emergencyFeeBdt > 0)) {
    return { ok: false, message: 'জরুরি সেবা চালু করতে তার ফি দিন।' };
  }
  return { ok: true };
}
