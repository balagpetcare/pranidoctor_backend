import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type { FoundationActor, VkAuditEventType } from '../knowledge-foundation.types.js';

export class KnowledgeAuditRepository {
  async append(params: {
    eventType: VkAuditEventType;
    entityId?: string;
    versionId?: string;
    actor?: FoundationActor;
    detail?: Record<string, unknown>;
  }) {
    return getPrisma().vkKnowledgeAuditEvent.create({
      data: {
        eventType: params.eventType,
        entityId: params.entityId ?? null,
        versionId: params.versionId ?? null,
        actorId: params.actor?.id ?? null,
        actorRole: params.actor?.role ?? null,
        ...(params.detail ? { detailJson: toInputJson(params.detail) } : {}),
      },
    });
  }

  async listForEntity(entityId: string, limit = 50) {
    return getPrisma().vkKnowledgeAuditEvent.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listForVersion(versionId: string, limit = 50) {
    return getPrisma().vkKnowledgeAuditEvent.findMany({
      where: { versionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listRecent(limit = 100) {
    return getPrisma().vkKnowledgeAuditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

let repo: KnowledgeAuditRepository | null = null;

export function getKnowledgeAuditRepository(): KnowledgeAuditRepository {
  if (!repo) repo = new KnowledgeAuditRepository();
  return repo;
}

export function resetKnowledgeAuditRepositoryForTests(): void {
  repo = null;
}
