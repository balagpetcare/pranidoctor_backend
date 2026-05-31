import { getPrisma } from '../../../shared/database/prisma.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

export type AiAuditEventStream = 'admin' | 'safety' | 'usage';

export interface AiAuditEvent {
  id: string;
  stream: AiAuditEventStream;
  action: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  detail: Record<string, unknown>;
}

export class AiPlatformAuditService {
  readonly name = 'AiPlatformAuditService';

  async search(params: { since: Date; limit?: number }): Promise<AiAuditEvent[]> {
    const limit = Math.min(params.limit ?? 100, 200);
    const prisma = getPrisma();

    const [keyAudit, safety, usage] = await Promise.all([
      prisma.aiApiKeyAuditLog.findMany({
        where: { createdAt: { gte: params.since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.aiSafetyAuditLog.findMany({
        where: { createdAt: { gte: params.since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.aiUsageLog.findMany({
        where: { createdAt: { gte: params.since }, success: false },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50),
      }),
    ]);

    const events: AiAuditEvent[] = [];

    for (const row of keyAudit) {
      events.push(
        omitUndefined({
          id: row.id,
          stream: 'admin',
          action: row.action,
          ...(row.actorUserId ? { actorUserId: row.actorUserId } : {}),
          targetType: 'ai_api_key',
          targetId: row.apiKeyId,
          severity: row.action === 'REVOKED' || row.action === 'DISABLED' ? 'warning' : 'info',
          createdAt: row.createdAt.toISOString(),
          detail: {
            providerKey: row.providerKey,
            metadataJson: row.metadataJson,
            reason: row.reason,
          },
        }) as AiAuditEvent,
      );
    }

    for (const row of safety) {
      events.push(
        omitUndefined({
          id: row.id,
          stream: 'safety',
          action: row.action,
          ...(row.userId ? { actorUserId: row.userId } : {}),
          severity: row.action.includes('BLOCK') ? 'warning' : 'info',
          createdAt: row.createdAt.toISOString(),
          detail: (row.detailJson as Record<string, unknown>) ?? {},
        }) as AiAuditEvent,
      );
    }

    for (const row of usage) {
      events.push(
        omitUndefined({
          id: row.id,
          stream: 'usage',
          action: row.success ? 'LLM_SUCCESS' : 'LLM_FAILURE',
          ...(row.userId ? { actorUserId: row.userId } : {}),
          targetType: 'ai_usage_log',
          targetId: row.id,
          severity: row.success ? 'info' : 'warning',
          createdAt: row.createdAt.toISOString(),
          detail: {
            feature: row.feature,
            providerKey: row.providerKey,
            modelKey: row.modelKey,
            errorCode: row.errorCode,
            routeId: row.routeId,
          },
        }) as AiAuditEvent,
      );
    }

    return events
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

let service: AiPlatformAuditService | null = null;

export function getAiPlatformAuditService(): AiPlatformAuditService {
  if (!service) service = new AiPlatformAuditService();
  return service;
}

export function resetAiPlatformAuditServiceForTests(): void {
  service = null;
}
