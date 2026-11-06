import { OfferingApproval, ProviderKind, ProviderServiceMode } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import type { DoctorTrackKey } from './doctor-tracks.rules.js';
import { tracksOfDoctor } from './doctor-tracks.service.js';
import {
  allowedSpeciesFor,
  catalogUsable,
  checkFees,
  checkPrice,
  customSpeciesAllowed,
  offeringSpeciesFromCatalog,
  type FeeInput,
} from './partner-services.rules.js';
import { PARTNER_ROLES, type PartnerRole } from './partner-roles.js';

export const MAX_PARTNER_OFFERINGS = 40;

export type ServiceResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

const fail = (httpStatus: number, code: string, message: string): ServiceResult<never> => ({
  ok: false,
  httpStatus,
  code,
  message,
});

type Ctx = {
  role: PartnerRole;
  profileId: string;
  active: boolean;
  allowedSpecies: string[];
};

/** The partner's primary (broadest) profile, derived from the database. */
async function contextFor(userId: string): Promise<Ctx | null> {
  const prisma = getPrisma();
  const [doctor, tech, worker] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.aiTechnicianProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.healthWorkerProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
  ]);
  const found = [
    doctor && { role: 'DOCTOR' as PartnerRole, id: doctor.id, status: doctor.providerStatus },
    tech && { role: 'AI_TECHNICIAN' as PartnerRole, id: tech.id, status: tech.providerStatus },
    worker && { role: 'HEALTH_WORKER' as PartnerRole, id: worker.id, status: worker.providerStatus },
  ].filter(Boolean) as { role: PartnerRole; id: string; status: string }[];
  const primary = PARTNER_ROLES.map((r) => found.find((f) => f.role === r)).find(Boolean);
  if (!primary) return null;

  let activeSpecies: string[] = [];
  if (primary.role === 'DOCTOR') {
    const tracks = await tracksOfDoctor(primary.id);
    activeSpecies = tracks
      .filter((t) => t.status === 'ACTIVE')
      .map((t) => ({ CATTLE_GOAT: 'cattle_goat', POULTRY_DUCK: 'poultry_duck', PET: 'pet' })[t.kind as DoctorTrackKey]);
  }
  return {
    role: primary.role,
    profileId: primary.id,
    active: primary.status === 'ACTIVE',
    allowedSpecies: allowedSpeciesFor(primary.role, activeSpecies),
  };
}

export type OfferingView = {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  priceBdt: number;
  durationMinutes: number | null;
  species: string[];
  isActive: boolean;
  isCustom: boolean;
  catalogId: string | null;
  approval: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalNote: string | null;
};

export type CatalogView = {
  id: string;
  titleBn: string;
  description: string | null;
  category: string;
  mode: string;
  species: string[];
  minPriceBdt: number | null;
  maxPriceBdt: number | null;
  suggestedDurationMinutes: number | null;
  alreadyAdded: boolean;
};

export type FeesView = {
  onlineFeeBdt: number | null;
  emergencyFeeBdt: number | null;
  visitFeeBdt: number | null;
  acceptsOnlineConsultation: boolean;
  acceptsEmergency: boolean;
};

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));

function toOffering(r: {
  id: string;
  title: string;
  description: string | null;
  mode: ProviderServiceMode;
  priceBdt: { toString(): string };
  durationMinutes: number | null;
  species: string[];
  isActive: boolean;
  catalogId: string | null;
  approval: OfferingApproval;
  approvalNote: string | null;
}): OfferingView {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    mode: r.mode,
    priceBdt: Number(r.priceBdt.toString()),
    durationMinutes: r.durationMinutes,
    species: r.species,
    isActive: r.isActive,
    isCustom: r.catalogId === null,
    catalogId: r.catalogId,
    approval: r.approval,
    approvalNote: r.approvalNote,
  };
}

async function feesOf(ctx: Ctx): Promise<FeesView | null> {
  if (ctx.role !== 'DOCTOR') return null;
  const d = await getPrisma().doctorProfile.findUnique({
    where: { id: ctx.profileId },
    select: {
      onlineFeeBdt: true,
      emergencyFeeBdt: true,
      visitFeeBdt: true,
      acceptsOnlineConsultation: true,
      acceptsEmergency: true,
    },
  });
  if (!d) return null;
  return {
    onlineFeeBdt: num(d.onlineFeeBdt),
    emergencyFeeBdt: num(d.emergencyFeeBdt),
    visitFeeBdt: num(d.visitFeeBdt),
    acceptsOnlineConsultation: d.acceptsOnlineConsultation,
    acceptsEmergency: d.acceptsEmergency,
  };
}

export async function getServiceSetup(userId: string): Promise<
  ServiceResult<{
    role: PartnerRole;
    profileActive: boolean;
    allowedSpecies: string[];
    maxOfferings: number;
    fees: FeesView | null;
    offerings: OfferingView[];
    catalog: CatalogView[];
  }>
> {
  const prisma = getPrisma();
  const ctx = await contextFor(userId);
  if (!ctx) return fail(409, 'NO_PROFILE', 'আগে সেবাদাতা হিসেবে আবেদন করুন।');

  const [offerings, catalog] = await Promise.all([
    prisma.providerServiceOffering.findMany({
      where: { kind: ctx.role as ProviderKind, providerId: ctx.profileId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.serviceCatalogItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const added = new Set(offerings.map((o) => o.catalogId).filter(Boolean));
  const usable = catalog
    .map((c) => ({
      row: c,
      lite: {
        providerKinds: c.providerKinds as string[],
        species: c.species,
        minPriceBdt: num(c.minPriceBdt),
        maxPriceBdt: num(c.maxPriceBdt),
        isActive: c.isActive,
      },
    }))
    .filter((c) => catalogUsable(c.lite, ctx.role, ctx.allowedSpecies));

  return {
    ok: true,
    data: {
      role: ctx.role,
      profileActive: ctx.active,
      allowedSpecies: ctx.allowedSpecies,
      maxOfferings: MAX_PARTNER_OFFERINGS,
      fees: await feesOf(ctx),
      offerings: offerings.map(toOffering),
      catalog: usable.map(({ row, lite }) => ({
        id: row.id,
        titleBn: row.titleBn,
        description: row.description,
        category: row.category,
        mode: row.mode,
        species: offeringSpeciesFromCatalog(lite, ctx.allowedSpecies),
        minPriceBdt: lite.minPriceBdt,
        maxPriceBdt: lite.maxPriceBdt,
        suggestedDurationMinutes: row.suggestedDurationMinutes,
        alreadyAdded: added.has(row.id),
      })),
    },
  };
}

async function guardWrite(userId: string): Promise<ServiceResult<Ctx>> {
  const ctx = await contextFor(userId);
  if (!ctx) return fail(409, 'NO_PROFILE', 'আগে সেবাদাতা হিসেবে আবেদন করুন।');
  if (!ctx.active) return fail(409, 'NOT_APPROVED', 'অনুমোদন পাওয়ার পর সেবা যোগ করতে পারবেন।');
  return { ok: true, data: ctx };
}

export async function addCatalogOffering(
  userId: string,
  input: { catalogId: string; priceBdt: number; durationMinutes?: number | undefined; isActive: boolean },
): Promise<ServiceResult<null>> {
  const g = await guardWrite(userId);
  if (!g.ok) return g;
  const ctx = g.data;
  const prisma = getPrisma();

  const item = await prisma.serviceCatalogItem.findUnique({ where: { id: input.catalogId } });
  const lite = item && {
    providerKinds: item.providerKinds as string[],
    species: item.species,
    minPriceBdt: num(item.minPriceBdt),
    maxPriceBdt: num(item.maxPriceBdt),
    isActive: item.isActive,
  };
  if (!item || !lite || !catalogUsable(lite, ctx.role, ctx.allowedSpecies)) {
    return fail(404, 'CATALOG_NOT_AVAILABLE', 'এই সেবা আপনার জন্য প্রযোজ্য নয়।');
  }
  const price = checkPrice(lite, input.priceBdt);
  if (!price.ok) return fail(422, 'PRICE_OUT_OF_RANGE', price.message);

  const where = { kind: ctx.role as ProviderKind, providerId: ctx.profileId };
  if (await prisma.providerServiceOffering.findFirst({ where: { ...where, catalogId: item.id }, select: { id: true } })) {
    return fail(409, 'ALREADY_ADDED', 'এই সেবা আগেই যোগ করা হয়েছে।');
  }
  const count = await prisma.providerServiceOffering.count({ where });
  if (count >= MAX_PARTNER_OFFERINGS) {
    return fail(409, 'OFFERING_LIMIT', `সর্বোচ্চ ${MAX_PARTNER_OFFERINGS}টি সেবা রাখা যাবে।`);
  }
  await prisma.providerServiceOffering.create({
    data: {
      ...where,
      title: item.titleBn,
      description: item.description,
      mode: item.mode,
      priceBdt: input.priceBdt,
      durationMinutes: input.durationMinutes ?? item.suggestedDurationMinutes,
      species: offeringSpeciesFromCatalog(lite, ctx.allowedSpecies),
      isActive: input.isActive,
      sortOrder: count,
      catalogId: item.id,
      approval: OfferingApproval.APPROVED,
    },
  });
  return { ok: true, data: null };
}

export async function addCustomOffering(
  userId: string,
  input: {
    title: string;
    description?: string | undefined;
    mode: ProviderServiceMode;
    priceBdt: number;
    durationMinutes?: number | undefined;
    species: string[];
  },
): Promise<ServiceResult<null>> {
  const g = await guardWrite(userId);
  if (!g.ok) return g;
  const ctx = g.data;
  const sp = customSpeciesAllowed(input.species, ctx.allowedSpecies);
  if (!sp.ok) return fail(422, 'SPECIES_NOT_ALLOWED', sp.message);

  const prisma = getPrisma();
  const where = { kind: ctx.role as ProviderKind, providerId: ctx.profileId };
  const count = await prisma.providerServiceOffering.count({ where });
  if (count >= MAX_PARTNER_OFFERINGS) {
    return fail(409, 'OFFERING_LIMIT', `সর্বোচ্চ ${MAX_PARTNER_OFFERINGS}টি সেবা রাখা যাবে।`);
  }
  await prisma.providerServiceOffering.create({
    data: {
      ...where,
      title: input.title,
      description: input.description ?? null,
      mode: input.mode,
      priceBdt: input.priceBdt,
      durationMinutes: input.durationMinutes ?? null,
      species: input.species,
      isActive: true,
      sortOrder: count,
      catalogId: null,
      approval: OfferingApproval.PENDING,
    },
  });
  return { ok: true, data: null };
}

export async function updateOffering(
  userId: string,
  id: string,
  patch: {
    priceBdt?: number | undefined;
    durationMinutes?: number | undefined;
    isActive?: boolean | undefined;
    title?: string | undefined;
    description?: string | undefined;
  },
): Promise<ServiceResult<null>> {
  const g = await guardWrite(userId);
  if (!g.ok) return g;
  const ctx = g.data;
  const prisma = getPrisma();
  const row = await prisma.providerServiceOffering.findFirst({
    where: { id, kind: ctx.role as ProviderKind, providerId: ctx.profileId },
  });
  if (!row) return fail(404, 'NOT_FOUND', 'সেবা পাওয়া যায়নি।');

  const custom = row.catalogId === null;
  const wantsText = patch.title !== undefined || patch.description !== undefined;
  if (wantsText && !custom) return fail(422, 'CATALOG_TEXT_LOCKED', 'তালিকাভুক্ত সেবার নাম বদলানো যায় না।');

  if (patch.priceBdt !== undefined && row.catalogId) {
    const item = await prisma.serviceCatalogItem.findUnique({ where: { id: row.catalogId } });
    if (item) {
      const price = checkPrice({ minPriceBdt: num(item.minPriceBdt), maxPriceBdt: num(item.maxPriceBdt) }, patch.priceBdt);
      if (!price.ok) return fail(422, 'PRICE_OUT_OF_RANGE', price.message);
    }
  }
  // Editing a custom service's wording sends it back for review.
  const resubmit = custom && wantsText;
  await prisma.providerServiceOffering.update({
    where: { id },
    data: {
      ...(patch.priceBdt !== undefined ? { priceBdt: patch.priceBdt } : {}),
      ...(patch.durationMinutes !== undefined ? { durationMinutes: patch.durationMinutes } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(resubmit ? { approval: OfferingApproval.PENDING, approvalNote: null } : {}),
    },
  });
  return { ok: true, data: null };
}

export async function deleteOffering(userId: string, id: string): Promise<ServiceResult<null>> {
  const ctx = await contextFor(userId);
  if (!ctx) return fail(409, 'NO_PROFILE', 'আগে সেবাদাতা হিসেবে আবেদন করুন।');
  const res = await getPrisma().providerServiceOffering.deleteMany({
    where: { id, kind: ctx.role as ProviderKind, providerId: ctx.profileId },
  });
  if (res.count === 0) return fail(404, 'NOT_FOUND', 'সেবা পাওয়া যায়নি।');
  return { ok: true, data: null };
}

export async function updateFees(userId: string, patch: FeeInput): Promise<ServiceResult<FeesView | null>> {
  const g = await guardWrite(userId);
  if (!g.ok) return g;
  const ctx = g.data;
  if (ctx.role !== 'DOCTOR') return fail(422, 'DOCTOR_ONLY', 'এই ফি শুধু ডাক্তারদের জন্য।');
  const current = await feesOf(ctx);
  const check = checkFees(current ?? {}, patch);
  if (!check.ok) return fail(422, 'FEE_INVALID', check.message);
  await getPrisma().doctorProfile.update({
    where: { id: ctx.profileId },
    data: {
      ...(patch.onlineFeeBdt !== undefined ? { onlineFeeBdt: patch.onlineFeeBdt } : {}),
      ...(patch.emergencyFeeBdt !== undefined ? { emergencyFeeBdt: patch.emergencyFeeBdt } : {}),
      ...(patch.visitFeeBdt !== undefined ? { visitFeeBdt: patch.visitFeeBdt } : {}),
      ...(patch.acceptsOnlineConsultation !== undefined
        ? { acceptsOnlineConsultation: patch.acceptsOnlineConsultation }
        : {}),
      ...(patch.acceptsEmergency !== undefined ? { acceptsEmergency: patch.acceptsEmergency } : {}),
    },
  });
  return { ok: true, data: await feesOf(ctx) };
}

