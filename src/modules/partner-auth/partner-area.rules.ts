import type { PartnerRole } from './partner-roles.js';

/**
 * Coverage limits per primary role (package). Districts cover the whole district;
 * upazilas are for extra pin-point coverage outside the chosen districts.
 * Defaults are launch values; the AI technician figure matches the 1500 BDT package.
 */
export type AreaLimits = { districts: number; upazilas: number };

export const DEFAULT_AREA_LIMITS: Record<PartnerRole, AreaLimits> = {
  DOCTOR: { districts: 5, upazilas: 15 },
  AI_TECHNICIAN: { districts: 2, upazilas: 4 },
  HEALTH_WORKER: { districts: 1, upazilas: 3 },
};

export const areaLimitsFor = (role: PartnerRole): AreaLimits => DEFAULT_AREA_LIMITS[role];

export type AreaPick = { id: string; type: string; parentId: string | null; isActive: boolean };

export type AreaCheck = { ok: true; ids: string[] } | { ok: false; message: string };

/** Validates a full replacement selection of district / upazila areas. */
export function checkAreaSelection(
  requestedIds: string[],
  found: AreaPick[],
  limits: AreaLimits,
): AreaCheck {
  const ids = [...new Set(requestedIds)];
  const byId = new Map(found.map((a) => [a.id, a]));
  const picks: AreaPick[] = [];
  for (const id of ids) {
    const a = byId.get(id);
    if (!a || !a.isActive) return { ok: false, message: 'নির্বাচিত এলাকাটি পাওয়া যায়নি।' };
    if (a.type !== 'DISTRICT' && a.type !== 'UPAZILA') {
      return { ok: false, message: 'শুধু জেলা বা উপজেলা বাছাই করা যাবে।' };
    }
    picks.push(a);
  }
  const districts = picks.filter((a) => a.type === 'DISTRICT');
  const upazilas = picks.filter((a) => a.type === 'UPAZILA');
  if (districts.length > limits.districts) {
    return { ok: false, message: `আপনার প্যাকেজে সর্বোচ্চ ${limits.districts}টি জেলা বাছাই করা যায়।` };
  }
  if (upazilas.length > limits.upazilas) {
    return { ok: false, message: `আপনার প্যাকেজে সর্বোচ্চ ${limits.upazilas}টি উপজেলা বাছাই করা যায়।` };
  }
  const districtIds = new Set(districts.map((d) => d.id));
  if (upazilas.some((u) => u.parentId && districtIds.has(u.parentId))) {
    return { ok: false, message: 'যে জেলা বাছাই করেছেন তার উপজেলা আলাদা করে বাছাইয়ের দরকার নেই।' };
  }
  return { ok: true, ids };
}

export type ProfileInput = {
  displayName?: string | null | undefined;
  bio?: string | null | undefined;
  experienceYears?: number | null | undefined;
};

export const PROFILE_LIMITS = { displayName: 80, bio: 1000, maxExperienceYears: 70 } as const;

export function checkProfile(input: ProfileInput): { ok: true } | { ok: false; message: string } {
  if (input.displayName != null && input.displayName.trim().length < 2) {
    return { ok: false, message: 'প্রদর্শিত নাম কমপক্ষে ২ অক্ষরের হতে হবে।' };
  }
  if (input.displayName != null && input.displayName.length > PROFILE_LIMITS.displayName) {
    return { ok: false, message: 'প্রদর্শিত নাম অনেক বড়।' };
  }
  if (input.bio != null && input.bio.length > PROFILE_LIMITS.bio) {
    return { ok: false, message: 'পরিচিতি অনেক বড়।' };
  }
  const y = input.experienceYears;
  if (y != null && (!Number.isInteger(y) || y < 0 || y > PROFILE_LIMITS.maxExperienceYears)) {
    return { ok: false, message: 'অভিজ্ঞতার বছর সঠিক নয়।' };
  }
  return { ok: true };
}
