import { getKnowledgeAuditService } from '../../knowledge-foundation/audit/knowledge-audit.service.js';
import type { FoundationActor, VkAuditEventType } from '../../knowledge-foundation/knowledge-foundation.types.js';
import type { GovernanceAuditEventType, GovernanceStage } from '../knowledge-governance.types.js';

export type GovernanceRecordEventType = GovernanceAuditEventType | VkAuditEventType;

export class GovernanceAuditService {
  readonly name = 'GovernanceAuditService';

  async record(params: {
    eventType: GovernanceRecordEventType;
    entityId?: string;
    versionId?: string;
    actor?: FoundationActor;
    governanceStage?: GovernanceStage;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await getKnowledgeAuditService().record({
      eventType: params.eventType,
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.versionId ? { versionId: params.versionId } : {}),
      ...(params.actor ? { actor: params.actor } : {}),
      detail: {
        ...(params.detail ?? {}),
        ...(params.governanceStage ? { governanceStage: params.governanceStage } : {}),
        schemaVersion: '6b4.0',
      },
    });
  }

  async recordStageChange(params: {
    entityId: string;
    versionId: string;
    fromStage: GovernanceStage;
    toStage: GovernanceStage;
    actor?: FoundationActor;
    reason?: string;
  }): Promise<void> {
    await this.record({
      eventType: 'GOVERNANCE_STAGE_CHANGED',
      entityId: params.entityId,
      versionId: params.versionId,
      ...(params.actor ? { actor: params.actor } : {}),
      governanceStage: params.toStage,
      detail: {
        fromStage: params.fromStage,
        toStage: params.toStage,
        ...(params.reason ? { reason: params.reason } : {}),
      },
    });
  }
}

let service: GovernanceAuditService | null = null;

export function getGovernanceAuditService(): GovernanceAuditService {
  if (!service) service = new GovernanceAuditService();
  return service;
}

export function resetGovernanceAuditServiceForTests(): void {
  service = null;
}
