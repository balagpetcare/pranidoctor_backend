import { getPrisma } from '../../shared/database/prisma.js';

import { checkSchedule, dhakaNow, isWithinSchedule, type SlotInput } from './partner-schedule.rules.js';
import type { PartnerRole } from './partner-roles.js';

export type AvailabilityResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

type ProfileRef = { kind: PartnerRole; id: string; active: boolean };

async function profilesOf(userId: string): Promise<ProfileRef[]> {
  const prisma = getPrisma();
  const [d, t, w] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.aiTechnicianProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.healthWorkerProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
  ]);
  const out: ProfileRef[] = [];
  if (d) out.push({ kind: 'DOCTOR', id: d.id, active: d.providerStatus === 'ACTIVE' });
  if (t) out.push({ kind: 'AI_TECHNICIAN', id: t.id, active: t.providerStatus === 'ACTIVE' });
  if (w) out.push({ kind: 'HEALTH_WORKER', id: w.id, active: w.providerStatus === 'ACTIVE' });
  return out;
}

export type AvailabilityView = {
  profileActive: boolean;
  online: boolean;
  /** True when "now" (Dhaka) falls inside a scheduled slot. */
  withinSchedule: boolean;
  slots: SlotInput[];
};

export async function getAvailability(userId: string): Promise<AvailabilityResult<AvailabilityView>> {
  const prisma = getPrisma();
  const profiles = await profilesOf(userId);
  if (profiles.length === 0) {
    return { ok: false, httpStatus: 409, code: 'NO_PROFILE', message: 'আগে সেবাদাতা হিসেবে আবেদন করুন।' };
  }
  const active = profiles.filter((p) => p.active);
  const [rows, presence] = await Promise.all([
    prisma.partnerScheduleSlot.findMany({
      where: { userId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      select: { weekday: true, startMinute: true, endMinute: true },
    }),
    active.length === 0
      ? Promise.resolve([])
      : prisma.providerPresence.findMany({
          where: { OR: active.map((p) => ({ kind: p.kind, providerId: p.id })) },
          select: { isOnline: true },
        }),
  ]);
  const now = dhakaNow();
  return {
    ok: true,
    data: {
      profileActive: active.length > 0,
      online: presence.some((p) => p.isOnline),
      withinSchedule: isWithinSchedule(rows, now.weekday, now.minute),
      slots: rows,
    },
  };
}

/** Replaces the whole weekly schedule. */
export async function saveSchedule(
  userId: string,
  input: SlotInput[],
): Promise<AvailabilityResult<AvailabilityView>> {
  const profiles = await profilesOf(userId);
  if (profiles.length === 0) {
    return { ok: false, httpStatus: 409, code: 'NO_PROFILE', message: 'আগে সেবাদাতা হিসেবে আবেদন করুন।' };
  }
  const checked = checkSchedule(input);
  if (!checked.ok) return { ok: false, httpStatus: 422, code: 'INVALID_SCHEDULE', message: checked.message };
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.partnerScheduleSlot.deleteMany({ where: { userId } }),
    prisma.partnerScheduleSlot.createMany({ data: checked.slots.map((s) => ({ userId, ...s })) }),
  ]);
  return getAvailability(userId);
}

/** Switches every ACTIVE profile of the user online/offline. */
export async function setOnline(
  userId: string,
  online: boolean,
): Promise<AvailabilityResult<AvailabilityView>> {
  const profiles = await profilesOf(userId);
  if (profiles.length === 0) {
    return { ok: false, httpStatus: 409, code: 'NO_PROFILE', message: 'আগে সেবাদাতা হিসেবে আবেদন করুন।' };
  }
  const eligible = profiles.filter((p) => p.active);
  if (eligible.length === 0) {
    return { ok: false, httpStatus: 409, code: 'NOT_APPROVED', message: 'অনুমোদন পাওয়ার পর অনলাইন হতে পারবেন।' };
  }
  const prisma = getPrisma();
  const now = new Date();
  await Promise.all(
    eligible.map((p) =>
      prisma.providerPresence.upsert({
        where: { kind_providerId: { kind: p.kind, providerId: p.id } },
        create: { kind: p.kind, providerId: p.id, isOnline: online, lastSeenAt: now },
        update: { isOnline: online, lastSeenAt: now },
      }),
    ),
  );
  return getAvailability(userId);
}
