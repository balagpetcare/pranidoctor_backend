import { matchFromRank } from './discovery.areas.js';
import type { ProviderCard, ProviderKindName } from './discovery.types.js';

export interface ProviderRow {
  id: string;
  name: string | null;
  subtitle: string | null;
  photo: string | null;
  reg_no: string | null;
  verified: boolean | null;
  exp: number | null;
  rating_avg: number | string | null;
  rating_count: number | string | null;
  fee_visit: number | string | null;
  fee_emergency: number | string | null;
  fee_online: number | string | null;
  fee_service: number | string | null;
  accepts_emergency: boolean | null;
  accepts_online: boolean | null;
  accepts_home_visit: boolean | null;
  tags: string[] | null;
  bio: string | null;
  is_online: boolean | null;
  match_rank: number | string | null;
  total?: number | string | null;
}

const FALLBACK_NAME: Record<ProviderKindName, string> = {
  DOCTOR: 'প্রাণী ডাক্তার',
  AI_TECHNICIAN: 'এআই টেকনিশিয়ান',
  HEALTH_WORKER: 'প্রাণী স্বাস্থ্যকর্মী',
};

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapProviderRow(
  kind: ProviderKindName,
  row: ProviderRow,
  ancestorTypes: readonly string[],
): ProviderCard {
  return {
    kind,
    id: row.id,
    name: row.name?.trim() ? row.name.trim() : FALLBACK_NAME[kind],
    subtitle: row.subtitle?.trim() ? row.subtitle.trim() : null,
    photoUrl: row.photo ?? null,
    verified: row.verified === true,
    registrationNo: row.reg_no ?? null,
    experienceYears: num(row.exp),
    rating: {
      avg: Math.round((num(row.rating_avg) ?? 0) * 10) / 10,
      count: num(row.rating_count) ?? 0,
    },
    fees: {
      visit: num(row.fee_visit),
      emergency: num(row.fee_emergency),
      online: num(row.fee_online),
      service: num(row.fee_service),
    },
    isOnline: row.is_online === true,
    acceptsEmergency: row.accepts_emergency === true,
    acceptsOnline: row.accepts_online === true,
    acceptsHomeVisit: row.accepts_home_visit === true,
    areaMatch: matchFromRank(num(row.match_rank), ancestorTypes),
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}
