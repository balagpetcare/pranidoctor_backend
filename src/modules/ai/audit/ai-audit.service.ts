import type { Prisma } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

export class AiAuditService {
  readonly name = 'AiAuditService';

  async write(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    detailJson?: Record<string, unknown>;
  }): Promise<void> {
    await getPrisma().aiSafetyAuditLog.create({
      data: omitUndefined({
        userId: params.userId,
        sessionId: params.sessionId,
        action: params.action,
        detailJson: (params.detailJson ?? {}) as Prisma.InputJsonValue,
      }),
    });
  }

  async search(params: {
    userId?: string;
    action?: string;
    since?: Date;
    limit?: number;
  }) {
    return getPrisma().aiSafetyAuditLog.findMany({
      where: {
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.action ? { action: params.action } : {}),
        ...(params.since ? { createdAt: { gte: params.since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
    });
  }

  async listEscalations(status?: string) {
    return getPrisma().aiEscalationRecord.findMany({
      ...(status ? { where: { status: status as never } } : {}),
      orderBy: { flaggedAt: 'desc' },
      take: 100,
    });
  }
}

let service: AiAuditService | null = null;

export function getAiAuditService(): AiAuditService {
  if (!service) service = new AiAuditService();
  return service;
}
