import { OfferingApproval, ProviderKind, ProviderServiceMode } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

export type CatalogInput = {
  key: string;
  titleBn: string;
  description?: string | null | undefined;
  category: string;
  providerKinds: ProviderKind[];
  species: string[];
  mode: ProviderServiceMode;
  minPriceBdt?: number | null | undefined;
  maxPriceBdt?: number | null | undefined;
  suggestedDurationMinutes?: number | null | undefined;
  isActive: boolean;
  sortOrder: number;
};

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));

export async function adminListCatalog() {
  const rows = await getPrisma().serviceCatalogItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return rows.map((r) => ({ ...r, minPriceBdt: num(r.minPriceBdt), maxPriceBdt: num(r.maxPriceBdt) }));
}

export type AdminResult = { ok: true } | { ok: false; httpStatus: number; code: string; message: string };

export async function adminCreateCatalogItem(input: CatalogInput): Promise<AdminResult> {
  const prisma = getPrisma();
  if (await prisma.serviceCatalogItem.findUnique({ where: { key: input.key }, select: { id: true } })) {
    return { ok: false, httpStatus: 409, code: 'KEY_EXISTS', message: 'এই কী (key) আগেই আছে।' };
  }
  await prisma.serviceCatalogItem.create({
    data: {
      ...input,
      description: input.description ?? null,
      minPriceBdt: input.minPriceBdt ?? null,
      maxPriceBdt: input.maxPriceBdt ?? null,
      suggestedDurationMinutes: input.suggestedDurationMinutes ?? null,
    },
  });
  return { ok: true };
}

export async function adminUpdateCatalogItem(id: string, patch: { [K in keyof CatalogInput]?: CatalogInput[K] | undefined }): Promise<AdminResult> {
  const prisma = getPrisma();
  const existing = await prisma.serviceCatalogItem.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'সেবা পাওয়া যায়নি।' };
  const { key: _key, ...rest } = patch; // the key is immutable
  await prisma.serviceCatalogItem.update({
    where: { id },
    data: Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
  });
  return { ok: true };
}

/** Custom services from providers, newest first. */
export async function adminListOfferings(approval: OfferingApproval, limit: number, offset: number) {
  const prisma = getPrisma();
  const where = { approval, catalogId: null };
  const [rows, total] = await Promise.all([
    prisma.providerServiceOffering.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.providerServiceOffering.count({ where }),
  ]);

  const names = new Map<string, string>();
  const ids = (k: ProviderKind) => [...new Set(rows.filter((r) => r.kind === k).map((r) => r.providerId))];
  const [docs, techs, workers] = await Promise.all([
    prisma.doctorProfile.findMany({ where: { id: { in: ids('DOCTOR') } }, select: { id: true, displayName: true, user: { select: { email: true } } } }),
    prisma.aiTechnicianProfile.findMany({ where: { id: { in: ids('AI_TECHNICIAN') } }, select: { id: true, displayName: true, user: { select: { email: true } } } }),
    prisma.healthWorkerProfile.findMany({ where: { id: { in: ids('HEALTH_WORKER') } }, select: { id: true, displayName: true, user: { select: { email: true } } } }),
  ]);
  for (const p of [...docs, ...techs, ...workers]) names.set(p.id, p.displayName || p.user.email);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      providerName: names.get(r.providerId) ?? '—',
      title: r.title,
      description: r.description,
      mode: r.mode,
      priceBdt: Number(r.priceBdt.toString()),
      durationMinutes: r.durationMinutes,
      species: r.species,
      approval: r.approval,
      approvalNote: r.approvalNote,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function adminDecideOffering(
  id: string,
  action: 'approve' | 'reject',
  note: string | undefined,
): Promise<AdminResult> {
  const prisma = getPrisma();
  const res = await prisma.providerServiceOffering.updateMany({
    where: { id, catalogId: null },
    data: {
      approval: action === 'approve' ? OfferingApproval.APPROVED : OfferingApproval.REJECTED,
      approvalNote: action === 'approve' ? null : note?.trim() || null,
    },
  });
  if (res.count === 0) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'সেবা পাওয়া যায়নি।' };
  return { ok: true };
}
