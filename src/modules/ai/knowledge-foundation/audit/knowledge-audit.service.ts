import { toKnowledgeAuditEventDto } from '../knowledge-foundation.mapper.js';
import type { FoundationActor, KnowledgeAuditEventDto, VkAuditEventType } from '../knowledge-foundation.types.js';
import { getKnowledgeAuditRepository } from './knowledge-audit.repository.js';

export class KnowledgeAuditService {
  readonly name = 'KnowledgeAuditService';

  async record(params: {
    eventType: VkAuditEventType;
    entityId?: string;
    versionId?: string;
    actor?: FoundationActor;
    detail?: Record<string, unknown>;
  }): Promise<KnowledgeAuditEventDto> {
    const row = await getKnowledgeAuditRepository().append({
      eventType: params.eventType,
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.versionId ? { versionId: params.versionId } : {}),
      ...(params.actor ? { actor: params.actor } : {}),
      ...(params.detail ? { detail: params.detail } : {}),
    });
    return toKnowledgeAuditEventDto(row);
  }

  async listEntityAudit(entityId: string, limit = 50): Promise<KnowledgeAuditEventDto[]> {
    const rows = await getKnowledgeAuditRepository().listForEntity(entityId, limit);
    return rows.map(toKnowledgeAuditEventDto);
  }

  async listVersionAudit(versionId: string, limit = 50): Promise<KnowledgeAuditEventDto[]> {
    const rows = await getKnowledgeAuditRepository().listForVersion(versionId, limit);
    return rows.map(toKnowledgeAuditEventDto);
  }

  async listRecent(limit = 100): Promise<KnowledgeAuditEventDto[]> {
    const rows = await getKnowledgeAuditRepository().listRecent(limit);
    return rows.map(toKnowledgeAuditEventDto);
  }
}

let service: KnowledgeAuditService | null = null;

export function getKnowledgeAuditService(): KnowledgeAuditService {
  if (!service) service = new KnowledgeAuditService();
  return service;
}

export function resetKnowledgeAuditServiceForTests(): void {
  service = null;
}
