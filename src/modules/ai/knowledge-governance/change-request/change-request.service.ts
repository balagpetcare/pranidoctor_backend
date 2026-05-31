import type { VkReviewStage } from '../../../../generated/prisma/index.js';
import type { ChangeRequestChecklistItem } from '../knowledge-governance.types.js';
import { KnowledgeGovernanceError } from '../knowledge-governance.errors.js';
import { getChangeRequestRepository } from '../repositories/change-request.repository.js';
import { getGovernanceAuditService } from '../audit/governance-audit.service.js';
import type { FoundationActor } from '../../knowledge-foundation/knowledge-foundation.types.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';

const DEFAULT_CHECKLIST_BY_STAGE: Record<VkReviewStage, ChangeRequestChecklistItem[]> = {
  EDITORIAL: [
    { code: 'CITATION_QUALITY', description: 'Improve citation quality and locators', required: true, resolved: false },
    { code: 'STRUCTURE', description: 'Fix content structure and completeness', required: true, resolved: false },
  ],
  LANGUAGE_BN: [
    { code: 'BN_LOCALE', description: 'Correct Bangla terminology and readability', required: true, resolved: false },
  ],
  LANGUAGE_EN: [
    { code: 'EN_CLINICAL', description: 'Correct English clinical precision', required: true, resolved: false },
  ],
  DOMAIN_LEAD: [
    { code: 'DOMAIN_SCHEMA', description: 'Align structured fields with domain schema', required: true, resolved: false },
  ],
  VET: [
    { code: 'DOSE_VERIFY', description: 'Verify dose and clinical claims against sources', required: true, resolved: false },
    { code: 'CITATION_LOCATOR', description: 'Add missing page/section locators on citations', required: true, resolved: false },
  ],
};

export class ChangeRequestService {
  async openFromReview(params: {
    versionId: string;
    entityId: string;
    reviewId: string;
    stage: VkReviewStage;
    requestedById: string;
    summaryBn?: string;
    summaryEn?: string;
    severity?: 'MINOR' | 'MAJOR' | 'BLOCKING';
    checklist?: ChangeRequestChecklistItem[];
    actor?: FoundationActor;
  }) {
    const checklist =
      params.checklist?.length ? params.checklist : DEFAULT_CHECKLIST_BY_STAGE[params.stage];

    const row = await getChangeRequestRepository().create(
      omitUndefined({
        versionId: params.versionId,
        reviewId: params.reviewId,
        stage: params.stage,
        requestedById: params.requestedById,
        summaryBn: params.summaryBn,
        summaryEn: params.summaryEn,
        severity: params.severity ?? 'MINOR',
        checklist,
      }),
    );

    await getGovernanceAuditService().record({
      eventType: 'CHANGE_REQUEST_OPENED',
      entityId: params.entityId,
      versionId: params.versionId,
      ...(params.actor ? { actor: params.actor } : {}),
      governanceStage: 'DRAFT',
      detail: {
        changeRequestId: row.id,
        reviewId: params.reviewId,
        stage: params.stage,
        severity: params.severity ?? 'MINOR',
      },
    });

    return row;
  }

  async resolveChecklistItem(params: {
    changeRequestId: string;
    code: string;
    entityId: string;
    versionId: string;
    actor?: FoundationActor;
  }): Promise<{ allRequiredResolved: boolean }> {
    const cr = await getChangeRequestRepository().findById(params.changeRequestId);
    if (!cr || cr.status !== 'OPEN') {
      return { allRequiredResolved: false };
    }

    const checklist = (cr.checklistJson as ChangeRequestChecklistItem[]).map((item) =>
      item.code === params.code
        ? { ...item, resolved: true, resolvedAt: new Date().toISOString() }
        : item,
    );

    await getChangeRequestRepository().updateChecklist(params.changeRequestId, checklist);

    const allRequiredResolved = checklist
      .filter((i) => i.required)
      .every((i) => i.resolved);

    if (allRequiredResolved) {
      await getChangeRequestRepository().markResolved(params.changeRequestId);
      await getGovernanceAuditService().record({
        eventType: 'CHANGE_REQUEST_RESOLVED',
        entityId: params.entityId,
        versionId: params.versionId,
        ...(params.actor ? { actor: params.actor } : {}),
        governanceStage: 'DRAFT',
        detail: { changeRequestId: params.changeRequestId },
      });
    }

    return { allRequiredResolved };
  }

  async assertResubmitReady(versionId: string): Promise<void> {
    const open = await getChangeRequestRepository().listOpenForVersion(versionId);
    for (const cr of open) {
      const checklist = cr.checklistJson as ChangeRequestChecklistItem[];
      const pending = checklist.filter((i) => i.required && !i.resolved);
      if (pending.length > 0) {
        throw new KnowledgeGovernanceError(
          'CHANGE_REQUEST_PENDING',
          `Unresolved change request checklist items: ${pending.map((p) => p.code).join(', ')}`,
        );
      }
    }
  }

  async listOpen(versionId: string) {
    return getChangeRequestRepository().listOpenForVersion(versionId);
  }
}

let service: ChangeRequestService | null = null;

export function getChangeRequestService(): ChangeRequestService {
  if (!service) service = new ChangeRequestService();
  return service;
}

export function resetChangeRequestServiceForTests(): void {
  service = null;
}
