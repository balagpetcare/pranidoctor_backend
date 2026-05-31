import type { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';

export type FeedAdminAuditInput = {
  entityId?: string;
  versionId?: string;
  eventType: string;
  actorId: string;
  actorRole?: string;
  detail?: Record<string, unknown>;
};

export async function recordFeedAdminAudit(
  input: FeedAdminAuditInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? getPrisma();
  await db.vkKnowledgeAuditEvent.create({
    data: {
      entityId: input.entityId,
      versionId: input.versionId,
      eventType: input.eventType,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detailJson: (input.detail ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listFeedAdminAudit(params: {
  entityId: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    eventType: string;
    actorId: string | null;
    actorRole: string | null;
    detailJson: unknown;
    createdAt: Date;
    versionId: string | null;
  }>
> {
  return getPrisma().vkKnowledgeAuditEvent.findMany({
    where: { entityId: params.entityId },
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 50,
    select: {
      id: true,
      eventType: true,
      actorId: true,
      actorRole: true,
      detailJson: true,
      createdAt: true,
      versionId: true,
    },
  });
}
