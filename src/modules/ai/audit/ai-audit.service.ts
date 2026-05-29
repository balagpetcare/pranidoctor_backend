import { getPrisma } from '../../../shared/database/prisma.js';

export class AiAuditService {
  readonly name = 'AiAuditService';

  async write(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    detailJson?: Record<string, unknown>;
  }): Promise<void> {
    await getPrisma().aiSafetyAuditLog.create({
      data: {
        userId: params.userId,
        sessionId: params.sessionId,
        action: params.action,
        detailJson: params.detailJson ?? {},
      },
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
      where: status ? { status: status as never } : undefined,
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
