import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type { ImportActor, KipAuditEventType } from '../knowledge-import.types.js';

/** Append-only import audit trail stored in VkKnowledgeAuditEvent with KIP event types. */
export class KnowledgeImportAuditRepository {
  async append(params: {
    eventType: KipAuditEventType;
    importRunId: string;
    entityId?: string;
    versionId?: string;
    actor?: ImportActor;
    detail?: Record<string, unknown>;
  }) {
    return getPrisma().vkKnowledgeAuditEvent.create({
      data: {
        eventType: params.eventType,
        entityId: params.entityId ?? null,
        versionId: params.versionId ?? null,
        actorId: params.actor?.id ?? null,
        actorRole: params.actor?.role ?? null,
        detailJson: toInputJson({
          importRunId: params.importRunId,
          ...(params.detail ?? {}),
        }),
      },
    });
  }

  async listForImportRun(importRunId: string, limit = 100) {
    return getPrisma().vkKnowledgeAuditEvent.findMany({
      where: {
        detailJson: {
          path: ['importRunId'],
          equals: importRunId,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}

let repo: KnowledgeImportAuditRepository | null = null;

export function getKnowledgeImportAuditRepository(): KnowledgeImportAuditRepository {
  if (!repo) repo = new KnowledgeImportAuditRepository();
  return repo;
}

export function resetKnowledgeImportAuditRepositoryForTests(): void {
  repo = null;
}
