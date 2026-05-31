import { KnowledgeGovernanceError } from '../knowledge-governance.errors.js';
import { getGovernanceConflictRepository } from '../repositories/governance-conflict.repository.js';
import { getGovernanceAuditService } from '../audit/governance-audit.service.js';
import type { FoundationActor } from '../../knowledge-foundation/knowledge-foundation.types.js';
import type { ResolveConflictInput } from '../knowledge-governance.types.js';

export class ConflictResolutionService {
  async assertNoBlockingConflicts(versionId: string, blockTypes?: string[]): Promise<void> {
    const open = await getGovernanceConflictRepository().listOpenForVersion(versionId);
    const blocking = open.filter((c) =>
      blockTypes ? blockTypes.includes(c.conflictType) : true,
    );
    if (blocking.length > 0) {
      throw new KnowledgeGovernanceError(
        'CONFLICT_OPEN',
        `Open governance conflict(s) block progression: ${blocking.map((c) => c.conflictType).join(', ')}`,
      );
    }
  }

  async openConflict(params: {
    versionId: string;
    entityId: string;
    conflictType: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
    openedById: string;
    assignedToId?: string;
    detail?: Record<string, unknown>;
    actor?: FoundationActor;
  }) {
    const row = await getGovernanceConflictRepository().create(params);

    await getGovernanceAuditService().record({
      eventType: 'CONFLICT_OPENED',
      entityId: params.entityId,
      versionId: params.versionId,
      ...(params.actor ? { actor: params.actor } : {}),
      detail: {
        conflictId: row.id,
        conflictType: params.conflictType,
      },
    });

    return row;
  }

  async resolveConflict(
    input: ResolveConflictInput,
    actor: FoundationActor,
  ): Promise<void> {
    const conflict = await getGovernanceConflictRepository().findById(input.conflictId);
    if (!conflict) {
      throw new KnowledgeGovernanceError('CONFLICT_NOT_FOUND', 'Governance conflict not found');
    }
    if (conflict.status === 'RESOLVED' || conflict.status === 'OVERRIDDEN') {
      return;
    }

    await getGovernanceConflictRepository().resolve({
      id: input.conflictId,
      decision: input.decision,
      rationale: input.rationale,
      resolvedById: actor.id,
      status: input.decision === 'OVERRIDE' ? 'OVERRIDDEN' : 'RESOLVED',
    });

    await getGovernanceAuditService().record({
      eventType: 'CONFLICT_RESOLVED',
      versionId: conflict.versionId,
      actor,
      detail: {
        conflictId: input.conflictId,
        decision: input.decision,
        rationale: input.rationale,
      },
    });
  }

  async listOpen(versionId: string) {
    return getGovernanceConflictRepository().listOpenForVersion(versionId);
  }
}

let service: ConflictResolutionService | null = null;

export function getConflictResolutionService(): ConflictResolutionService {
  if (!service) service = new ConflictResolutionService();
  return service;
}

export function resetConflictResolutionServiceForTests(): void {
  service = null;
}
