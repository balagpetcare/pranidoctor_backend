import { requiresVetApproval } from '../../knowledge-foundation/knowledge-foundation.types.js';
import { getKnowledgeGovernanceOrchestratorService } from '../../knowledge-governance/index.js';
import type { ImportActor, NormalizedEntityDraft, SourceFamilyProfile } from '../knowledge-import.types.js';

export class ApprovalRoutingService {
  readonly name = 'ApprovalRoutingService';

  async routeImportedVersion(params: {
    versionId: string;
    entityId: string;
    draft: NormalizedEntityDraft;
    profile: SourceFamilyProfile;
    importRunId: string;
    actor?: ImportActor;
    autoSubmit?: boolean;
  }): Promise<'EDITORIAL' | 'VET' | 'DRAFT'> {
    const needsVet =
      params.profile.requiresVetByDefault ||
      requiresVetApproval(params.draft.clinicalRiskTier as never);

    if (!params.autoSubmit) {
      return 'DRAFT';
    }

    await getKnowledgeGovernanceOrchestratorService().submitForReview(
      {
        versionId: params.versionId,
        queueSource: 'INGESTION',
        importRunId: params.importRunId,
      },
      {
        id: params.actor?.id ?? 'import-pipeline',
        role: params.actor?.role ?? 'ADMIN',
      },
    );

    return needsVet ? 'VET' : 'EDITORIAL';
  }
}

let service: ApprovalRoutingService | null = null;

export function getApprovalRoutingService(): ApprovalRoutingService {
  if (!service) service = new ApprovalRoutingService();
  return service;
}

export function resetApprovalRoutingForTests(): void {
  service = null;
}
