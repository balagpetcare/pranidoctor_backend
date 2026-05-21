import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { assertTechnicianCanUseTemplates } from "./semen-template-catalog-service";

function serializeLot(row: {
  id: string;
  aiTechnicianServiceId: string;
  currentQuantity: number;
  reservedQuantity: number;
  usedQuantity: number;
  minStockAlert: number | null;
  batchNumber: string | null;
  expiryDate: Date | null;
  sourceNote: string | null;
  storageNote: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    aiTechnicianServiceId: row.aiTechnicianServiceId,
    currentQuantity: row.currentQuantity,
    reservedQuantity: row.reservedQuantity,
    usedQuantity: row.usedQuantity,
    minStockAlert: row.minStockAlert,
    batchNumber: row.batchNumber,
    expiryDate: row.expiryDate?.toISOString() ?? null,
    sourceNote: row.sourceNote,
    storageNote: row.storageNote,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedSemenService(userId: string, serviceId: string) {
  const gate = await assertTechnicianCanUseTemplates(userId);
  if (gate.ok !== true) return gate;
  const svc = await prisma.aiTechnicianService.findFirst({
    where: { id: serviceId, aiTechnicianId: gate.profileId },
    select: { id: true, semenServiceTemplateId: true },
  });
  if (!svc) return { ok: "NOT_FOUND" as const };
  if (!svc.semenServiceTemplateId) return { ok: "NOT_SEMEN_SERVICE" as const };
  return { ok: true as const, profileId: gate.profileId, service: svc };
}

export async function listSemenInventoryLots(userId: string, serviceId: string) {
  const r = await getOwnedSemenService(userId, serviceId);
  if (r.ok !== true) return r;
  const rows = await prisma.technicianSemenInventory.findMany({
    where: { aiTechnicianServiceId: serviceId },
    orderBy: [{ createdAt: "desc" }],
  });
  return { ok: true as const, lots: rows.map(serializeLot) };
}

export type CreateInventoryLotBody = {
  currentQuantity: number;
  reservedQuantity?: number;
  usedQuantity?: number;
  minStockAlert?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  sourceNote?: string | null;
  storageNote?: string | null;
};

function validateQuantities(p: {
  currentQuantity: number;
  reservedQuantity: number;
  usedQuantity: number;
}) {
  if (p.currentQuantity < 0 || p.reservedQuantity < 0 || p.usedQuantity < 0) return false;
  if (p.reservedQuantity > p.currentQuantity) return false;
  return true;
}

export async function createSemenInventoryLot(
  userId: string,
  serviceId: string,
  body: CreateInventoryLotBody,
) {
  const r = await getOwnedSemenService(userId, serviceId);
  if (r.ok !== true) return r;
  const reserved = body.reservedQuantity ?? 0;
  const used = body.usedQuantity ?? 0;
  if (!validateQuantities({ currentQuantity: body.currentQuantity, reservedQuantity: reserved, usedQuantity: used })) {
    return { ok: "INVALID_STOCK" as const };
  }
  const row = await prisma.technicianSemenInventory.create({
    data: {
      aiTechnicianServiceId: serviceId,
      currentQuantity: body.currentQuantity,
      reservedQuantity: reserved,
      usedQuantity: used,
      minStockAlert: body.minStockAlert ?? null,
      batchNumber: body.batchNumber?.trim() || null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      sourceNote: body.sourceNote?.trim() || null,
      storageNote: body.storageNote?.trim() || null,
      isActive: true,
    },
  });
  return { ok: true as const, lot: serializeLot(row) };
}

export type PatchInventoryLotBody = Partial<CreateInventoryLotBody> & {
  isActive?: boolean;
};

export async function patchSemenInventoryLot(
  userId: string,
  serviceId: string,
  lotId: string,
  body: PatchInventoryLotBody,
) {
  const r = await getOwnedSemenService(userId, serviceId);
  if (r.ok !== true) return r;
  const existing = await prisma.technicianSemenInventory.findFirst({
    where: { id: lotId, aiTechnicianServiceId: serviceId },
  });
  if (!existing) return { ok: "NOT_FOUND" as const };

  const current = body.currentQuantity ?? existing.currentQuantity;
  const reserved = body.reservedQuantity ?? existing.reservedQuantity;
  const used = body.usedQuantity ?? existing.usedQuantity;
  if (!validateQuantities({ currentQuantity: current, reservedQuantity: reserved, usedQuantity: used })) {
    return { ok: "INVALID_STOCK" as const };
  }

  const data: Prisma.TechnicianSemenInventoryUpdateInput = {};
  if (body.currentQuantity !== undefined) data.currentQuantity = body.currentQuantity;
  if (body.reservedQuantity !== undefined) data.reservedQuantity = body.reservedQuantity;
  if (body.usedQuantity !== undefined) data.usedQuantity = body.usedQuantity;
  if (body.minStockAlert !== undefined) data.minStockAlert = body.minStockAlert;
  if (body.batchNumber !== undefined) data.batchNumber = body.batchNumber?.trim() || null;
  if (body.expiryDate !== undefined) {
    data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
  }
  if (body.sourceNote !== undefined) data.sourceNote = body.sourceNote?.trim() || null;
  if (body.storageNote !== undefined) data.storageNote = body.storageNote?.trim() || null;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const row = await prisma.technicianSemenInventory.update({
    where: { id: lotId },
    data,
  });
  return { ok: true as const, lot: serializeLot(row) };
}

export async function aggregateStockForService(serviceId: string) {
  const rows = await prisma.technicianSemenInventory.findMany({
    where: { aiTechnicianServiceId: serviceId, isActive: true },
    select: {
      currentQuantity: true,
      reservedQuantity: true,
      minStockAlert: true,
    },
  });
  let totalAvailable = 0;
  let lowStock = false;
  for (const r of rows) {
    const avail = r.currentQuantity - r.reservedQuantity;
    totalAvailable += Math.max(0, avail);
    if (r.minStockAlert != null && avail <= r.minStockAlert) lowStock = true;
  }
  return {
    totalAvailable,
    lotsCount: rows.length,
    lowStock,
  };
}
