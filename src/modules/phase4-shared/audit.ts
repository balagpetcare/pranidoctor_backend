import type { LivestockAuditAction, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

export async function writeLivestockAudit(
  customerId: string,
  action: LivestockAuditAction,
  entityType: string,
  entityId: string | null,
  actorUserId?: string,
  payload?: Prisma.InputJsonValue,
) {
  await prisma.livestockAuditLog.create({
    data: {
      customerId,
      action,
      entityType,
      entityId,
      actorUserId: actorUserId ?? null,
      ...(payload !== undefined ? { payload } : {}),
    },
  });
}
