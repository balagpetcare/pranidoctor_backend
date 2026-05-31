import { getKnowledgeAuditService } from '../../knowledge-foundation/audit/knowledge-audit.service.js';
import type { ImportActor, KipAuditEventType } from '../knowledge-import.types.js';
import { getKnowledgeImportAuditRepository } from './knowledge-import-audit.repository.js';

const KIP_TO_VKF_AUDIT: Partial<Record<KipAuditEventType, 'ENTITY_CREATED' | 'REVIEW_OPENED'>> = {
  IMPORT_VERSION_CREATED: 'ENTITY_CREATED',
  IMPORT_ROUTED_EDITORIAL: 'REVIEW_OPENED',
  IMPORT_ROUTED_VET: 'REVIEW_OPENED',
};

export class KnowledgeImportAuditService {
  readonly name = 'KnowledgeImportAuditService';

  async record(params: {
    eventType: KipAuditEventType;
    importRunId: string;
    entityId?: string;
    versionId?: string;
    actor?: ImportActor;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await getKnowledgeImportAuditRepository().append(params);

    const vkfEvent = KIP_TO_VKF_AUDIT[params.eventType];
    if (vkfEvent && params.entityId && params.versionId) {
      await getKnowledgeAuditService().record({
        eventType: vkfEvent,
        entityId: params.entityId,
        versionId: params.versionId,
        ...(params.actor ? { actor: params.actor } : {}),
        detail: {
          kipEvent: params.eventType,
          importRunId: params.importRunId,
          ...(params.detail ?? {}),
        },
      });
    }
  }
}

let service: KnowledgeImportAuditService | null = null;

export function getKnowledgeImportAuditService(): KnowledgeImportAuditService {
  if (!service) service = new KnowledgeImportAuditService();
  return service;
}

export function resetKnowledgeImportAuditForTests(): void {
  service = null;
}
