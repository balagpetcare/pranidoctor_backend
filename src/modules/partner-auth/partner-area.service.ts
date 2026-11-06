import { getPrisma } from '../../shared/database/prisma.js';

import { areaLimitsFor, checkAreaSelection, checkProfile, type AreaLimits, type ProfileInput } from './partner-area.rules.js';
import { PARTNER_ROLES, type PartnerRole } from './partner-roles.js';

export type AreaResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

const fail = (httpStatus: number, code: string, message: string): AreaResult<never> => ({
  ok: false,
  httpStatus,
  code,
  message,
});
const NO_PROFILE = () => fail(409, 'NO_PROFILE', 'আগে সেবাদাতা হিসেবে আবেদন করুন।');

type Refs = {
  primary: PartnerRole;
  doctorId: string | null;
  techId: string | null;
  workerId: string | null;
  active: boolean;
};

async function refsOf(userId: string): Promise<Refs | null> {
  const prisma = getPrisma();
  const [d, t, w] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.aiTechnicianProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.healthWorkerProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
  ]);
  const found: Array<{ role: PartnerRole; status: string }> = [];
  if (d) found.push({ role: 'DOCTOR', status: d.providerStatus });
  if (t) found.push({ role: 'AI_TECHNICIAN', status: t.providerStatus });
  if (w) found.push({ role: 'HEALTH_WORKER', status: w.providerStatus });
  const primary = PARTNER_ROLES.map((r) => found.find((f) => f.role === r)).find(Boolean);
  if (!primary) return null;
  return {
    primary: primary.role,
    doctorId: d?.id ?? null,
    techId: t?.id ?? null,
    workerId: w?.id ?? null,
    active: primary.status === 'ACTIVE',
  };
}

const label = (a: { nameBn: string | null; name: string }) => a.nameBn?.trim() || a.name;

export type AreaView = {
  role: PartnerRole;
  profileActive: boolean;
  limits: AreaLimits;
  selected: Array<{ id: string; type: string; nameBn: string; parentNameBn: string | null }>;
  districts: Array<{ id: string; nameBn: string; divisionNameBn: string | null }>;
};

export async function getAreaSetup(userId: string): Promise<AreaResult<AreaView>> {
  const prisma = getPrisma();
  const refs = await refsOf(userId);
  if (!refs) return NO_PROFILE();

  const selectedLinks = refs.doctorId
    ? await prisma.doctorProfileArea.findMany({ where: { doctorId: refs.doctorId }, select: { areaId: true } })
    : refs.techId
      ? await prisma.aiTechnicianProfileArea.findMany({ where: { aiTechnicianId: refs.techId }, select: { areaId: true } })
      : refs.workerId
        ? await prisma.healthWorkerProfileArea.findMany({ where: { healthWorkerId: refs.workerId }, select: { areaId: true } })
        : [];

  const [selectedAreas, districts] = await Promise.all([
    prisma.area.findMany({
      where: { id: { in: selectedLinks.map((l) => l.areaId) }, type: { in: ['DISTRICT', 'UPAZILA'] } },
      select: { id: true, type: true, name: true, nameBn: true, parent: { select: { name: true, nameBn: true } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.area.findMany({
      where: { type: 'DISTRICT', isActive: true },
      select: { id: true, name: true, nameBn: true, parent: { select: { name: true, nameBn: true } } },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  return {
    ok: true,
    data: {
      role: refs.primary,
      profileActive: refs.active,
      limits: areaLimitsFor(refs.primary),
      selected: selectedAreas.map((a) => ({
        id: a.id,
        type: a.type,
        nameBn: label(a),
        parentNameBn: a.parent ? label(a.parent) : null,
      })),
      districts: districts.map((a) => ({ id: a.id, nameBn: label(a), divisionNameBn: a.parent ? label(a.parent) : null })),
    },
  };
}

/** Upazilas (or any children) of a district, for the picker. */
export async function listChildAreas(
  parentId: string,
): Promise<AreaResult<Array<{ id: string; nameBn: string; type: string }>>> {
  const rows = await getPrisma().area.findMany({
    where: { parentId, isActive: true, type: 'UPAZILA' },
    select: { id: true, name: true, nameBn: true, type: true },
    orderBy: [{ name: 'asc' }],
  });
  return { ok: true, data: rows.map((r) => ({ id: r.id, nameBn: label(r), type: r.type })) };
}

/** Replaces coverage on every profile the partner holds (so lower-role discovery works too). */
export async function saveAreas(userId: string, areaIds: string[]): Promise<AreaResult<AreaView>> {
  const prisma = getPrisma();
  const refs = await refsOf(userId);
  if (!refs) return NO_PROFILE();

  const found = await prisma.area.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, type: true, parentId: true, isActive: true },
  });
  const checked = checkAreaSelection(areaIds, found, areaLimitsFor(refs.primary));
  if (!checked.ok) return fail(422, 'INVALID_AREA', checked.message);

  const ops = [];
  if (refs.doctorId) {
    const doctorId = refs.doctorId;
    ops.push(prisma.doctorProfileArea.deleteMany({ where: { doctorId } }));
    ops.push(prisma.doctorProfileArea.createMany({ data: checked.ids.map((areaId, i) => ({ doctorId, areaId, priority: i })) }));
  }
  if (refs.techId) {
    const aiTechnicianId = refs.techId;
    ops.push(prisma.aiTechnicianProfileArea.deleteMany({ where: { aiTechnicianId } }));
    ops.push(prisma.aiTechnicianProfileArea.createMany({ data: checked.ids.map((areaId, i) => ({ aiTechnicianId, areaId, priority: i })) }));
  }
  if (refs.workerId) {
    const healthWorkerId = refs.workerId;
    ops.push(prisma.healthWorkerProfileArea.deleteMany({ where: { healthWorkerId } }));
    ops.push(prisma.healthWorkerProfileArea.createMany({ data: checked.ids.map((areaId, i) => ({ healthWorkerId, areaId, priority: i })) }));
  }
  await prisma.$transaction(ops);
  return getAreaSetup(userId);
}

export type ProfileView = {
  role: PartnerRole;
  displayName: string | null;
  bio: string | null;
  experienceYears: number | null;
};

export async function getPartnerProfile(userId: string): Promise<AreaResult<ProfileView>> {
  const prisma = getPrisma();
  const refs = await refsOf(userId);
  if (!refs) return NO_PROFILE();
  const sel = { displayName: true, bio: true, experienceYears: true } as const;
  const row = refs.doctorId
    ? await prisma.doctorProfile.findUnique({ where: { id: refs.doctorId }, select: sel })
    : refs.techId
      ? await prisma.aiTechnicianProfile.findUnique({ where: { id: refs.techId }, select: sel })
      : await prisma.healthWorkerProfile.findUnique({ where: { id: refs.workerId ?? '' }, select: sel });
  return {
    ok: true,
    data: {
      role: refs.primary,
      displayName: row?.displayName ?? null,
      bio: row?.bio ?? null,
      experienceYears: row?.experienceYears ?? null,
    },
  };
}

/** Updates customer-visible profile text on every profile the partner holds. */
export async function savePartnerProfile(
  userId: string,
  input: ProfileInput,
): Promise<AreaResult<ProfileView>> {
  const prisma = getPrisma();
  const refs = await refsOf(userId);
  if (!refs) return NO_PROFILE();
  const checked = checkProfile(input);
  if (!checked.ok) return fail(422, 'INVALID_PROFILE', checked.message);

  const data: { displayName?: string | null; bio?: string | null; experienceYears?: number | null } = {};
  if (input.displayName !== undefined) data.displayName = input.displayName?.trim() || null;
  if (input.bio !== undefined) data.bio = input.bio?.trim() || null;
  if (input.experienceYears !== undefined) data.experienceYears = input.experienceYears;

  const ops = [];
  if (refs.doctorId) ops.push(prisma.doctorProfile.update({ where: { id: refs.doctorId }, data }));
  if (refs.techId) ops.push(prisma.aiTechnicianProfile.update({ where: { id: refs.techId }, data }));
  if (refs.workerId) ops.push(prisma.healthWorkerProfile.update({ where: { id: refs.workerId }, data }));
  await prisma.$transaction(ops);
  return getPartnerProfile(userId);
}
