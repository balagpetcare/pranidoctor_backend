import { toKnowledgeVersionDto } from '../knowledge-foundation/knowledge-foundation.mapper.js';
import {
  evaluateCitationTrustRules,
  computeVersionSignOffHash,
  filterVersionLevelSignOffCitations,
} from '../knowledge-foundation/knowledge-foundation.util.js';
import { KnowledgeWorkflowError } from '../knowledge-foundation/knowledge-foundation.errors.js';
import { getKnowledgeCitationRepository } from '../knowledge-foundation/repositories/knowledge-citation.repository.js';
import { getKnowledgeVersionRepository } from '../knowledge-foundation/repositories/knowledge-version.repository.js';
import { getKnowledgeReviewRepository } from '../knowledge-foundation/repositories/knowledge-review.repository.js';
import { getKnowledgeApprovalRepository } from '../knowledge-foundation/repositories/knowledge-approval.repository.js';
import { getKnowledgeEntityRepository } from '../knowledge-foundation/repositories/knowledge-entity.repository.js';
import { getKnowledgeFoundationService } from '../knowledge-foundation/knowledge-foundation.service.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getKnowledgeChunkingOrchestratorService } from '../knowledge-chunking/index.js';
import { getGovernanceAuditService } from './audit/governance-audit.service.js';
import { getChangeRequestService } from './change-request/change-request.service.js';
import { getConflictResolutionService } from './conflict/conflict-resolution.service.js';
import { KnowledgeGovernanceError } from './knowledge-governance.errors.js';
import type {
  ArchiveGovernanceInput,
  CompleteGovernanceReviewInput,
  GovernanceActor,
  GovernanceStage,
  PublishGovernanceInput,
  RecordGovernanceVetApprovalInput,
  ResolveChangeRequestItemInput,
  ResolveConflictInput,
  SubmitForReviewInput,
} from './knowledge-governance.types.js';
import {
  requiredReviewStages,
  resolveGovernanceStage,
} from './stages/governance-stage.resolver.js';
import {
  assertVetScope,
  isExpeditedEligible,
  requiresVetReviewPath,
} from './policy/vet-path.policy.js';
import { computeApprovalValidUntil } from './policy/expiration-policy.registry.js';
import type { VkReviewStage } from '../../../generated/prisma/index.js';
import type { KnowledgeVersionDto } from '../knowledge-foundation/knowledge-foundation.types.js';

export class KnowledgeGovernanceOrchestratorService {
  readonly name = 'KnowledgeGovernanceOrchestratorService';

  async getGovernanceStage(versionId: string): Promise<GovernanceStage> {
    const version = await getKnowledgeVersionRepository().requireVersion(versionId);
    const openReviews = await getKnowledgeReviewRepository().listOpenForVersion(versionId);
    const hasOpenVetReview = openReviews.some((r) => r.stage === 'VET');
    const approval = await getKnowledgeApprovalRepository().findLatestValid(versionId);
    const hasExpedited = await this.hasExpeditedApproval(versionId);
    const hasEditorialReady = await this.hasEditorialApprovalReady(versionId);

    return resolveGovernanceStage({
      status: version.status,
      hasOpenReview: openReviews.length > 0,
      hasOpenVetReview,
      hasValidApproval: approval != null,
      hasExpeditedApproval: hasExpedited,
      hasEditorialApprovalReady: hasEditorialReady,
    });
  }

  private async hasEditorialApprovalReady(versionId: string): Promise<boolean> {
    const version = await getKnowledgeVersionRepository().findPlainById(versionId);
    if (!version || version.status !== 'IN_REVIEW') return false;

    const entity = await getKnowledgeEntityRepository().requireEntity(version.entityId);
    if (requiresVetReviewPath({ clinicalRiskTier: version.clinicalRiskTier, domain: entity.domain })) {
      return false;
    }

    return this.allRequiredReviewsApproved(versionId, version.audience);
  }

  private async hasExpeditedApproval(versionId: string): Promise<boolean> {
    const version = await getKnowledgeVersionRepository().findPlainById(versionId);
    if (!version) return false;
    const entity = await getKnowledgeEntityRepository().requireEntity(version.entityId);
    if (!isExpeditedEligible({ clinicalRiskTier: version.clinicalRiskTier, domain: entity.domain })) {
      return false;
    }
    return getKnowledgeReviewRepository().hasApprovedStage(versionId, 'DOMAIN_LEAD');
  }

  async submitForReview(
    input: SubmitForReviewInput,
    actor?: GovernanceActor,
  ): Promise<KnowledgeVersionDto> {
    const versionId = input.versionId;
    const version = await getKnowledgeVersionRepository().requireVersion(versionId);

    if (version.status !== 'DRAFT' && version.status !== 'CHANGES_REQUESTED') {
      throw new KnowledgeGovernanceError(
        'INVALID_STATUS',
        `Cannot submit version in status ${version.status}`,
      );
    }

    await getConflictResolutionService().assertNoBlockingConflicts(versionId, ['C4']);

    if (version.status === 'CHANGES_REQUESTED') {
      await getChangeRequestService().assertResubmitReady(versionId);
    }

    const citationCount = await getKnowledgeCitationRepository().countByVersion(versionId);
    if (citationCount < 1) {
      throw new KnowledgeWorkflowError('CITATION_REQUIRED', 'At least one source citation is required');
    }

    const citations = await getKnowledgeCitationRepository().listByVersion(versionId);
    const trust = evaluateCitationTrustRules({
      clinicalRiskTier: version.clinicalRiskTier,
      citations: citations.map((c) => ({
        pageRef: c.pageRef,
        sectionRef: c.sectionRef,
        sourceTrustTier: c.source.trustTier,
      })),
    });
    if (!trust.ok) {
      throw new KnowledgeWorkflowError(trust.code, trust.message);
    }

    if (!version.titleBn.trim() || !version.bodyBn.trim()) {
      throw new KnowledgeWorkflowError('BN_CONTENT_REQUIRED', 'Bangla content required before submit');
    }
    if (!version.titleEn.trim() || !version.bodyEn.trim()) {
      throw new KnowledgeWorkflowError('EN_CONTENT_REQUIRED', 'English content required before submit');
    }

    await getKnowledgeChunkingOrchestratorService().processVersion({ versionId });

    const fromStage = await this.getGovernanceStage(versionId);

    await getKnowledgeReviewRepository().openReview({
      versionId,
      stage: 'EDITORIAL',
      ...(actor?.id ? { reviewerId: actor.id } : {}),
      queueSource: input.queueSource ?? 'MANUAL',
      ...(input.importRunId ? { importRunId: input.importRunId } : {}),
    });

    const updated = await getKnowledgeVersionRepository().updateStatus(versionId, 'IN_REVIEW', {
      submittedAt: new Date(),
    });

    await getGovernanceAuditService().record({
      eventType: 'VERSION_SUBMITTED',
      entityId: version.entityId,
      versionId,
      ...(actor ? { actor } : {}),
      governanceStage: 'REVIEW',
    });

    await getGovernanceAuditService().recordStageChange({
      entityId: version.entityId,
      versionId,
      fromStage,
      toStage: 'REVIEW',
      ...(actor ? { actor } : {}),
      reason: 'submit_for_review',
    });

    if (version.status === 'CHANGES_REQUESTED') {
      await getGovernanceAuditService().record({
        eventType: 'VERSION_RESUBMITTED',
        entityId: version.entityId,
        versionId,
        ...(actor ? { actor } : {}),
        governanceStage: 'REVIEW',
      });
    }

    return toKnowledgeVersionDto(updated);
  }

  async completeReview(
    input: CompleteGovernanceReviewInput,
    actor?: GovernanceActor,
  ): Promise<KnowledgeVersionDto> {
    const review = await getKnowledgeReviewRepository().findById(input.reviewId);
    if (!review) {
      throw new KnowledgeWorkflowError('REVIEW_NOT_FOUND', 'Review not found');
    }

    const version = review.version;
    const entity = version.entity;
    const fromStage = await this.getGovernanceStage(review.versionId);

    await getKnowledgeReviewRepository().completeReview(
      omitUndefined({
        reviewId: input.reviewId,
        decision: input.decision,
        reviewerId: input.reviewerId,
        comments: input.comments,
      }),
    );

    await getGovernanceAuditService().record({
      eventType: 'REVIEW_COMPLETED',
      entityId: entity.id,
      versionId: review.versionId,
      ...(actor ? { actor } : {}),
      governanceStage: fromStage,
      detail: { decision: input.decision, stage: review.stage },
    });

    if (input.decision === 'REJECT') {
      const updated = await getKnowledgeVersionRepository().updateStatus(review.versionId, 'REJECTED');
      await getGovernanceAuditService().record({
        eventType: 'VERSION_ARCHIVED',
        entityId: entity.id,
        versionId: review.versionId,
        ...(actor ? { actor } : {}),
        governanceStage: 'ARCHIVED',
        detail: { archiveType: 'REJECT', reason: input.comments ?? 'Rejected in review' },
      });
      await getGovernanceAuditService().recordStageChange({
        entityId: entity.id,
        versionId: review.versionId,
        fromStage,
        toStage: 'ARCHIVED',
        ...(actor ? { actor } : {}),
        reason: 'review_reject',
      });
      return toKnowledgeVersionDto(updated);
    }

    if (input.decision === 'REQUEST_CHANGES') {
      await getChangeRequestService().openFromReview(
        omitUndefined({
          versionId: review.versionId,
          entityId: entity.id,
          reviewId: input.reviewId,
          stage: review.stage,
          requestedById: input.reviewerId,
          summaryBn: input.changeRequest?.summaryBn,
          summaryEn: input.changeRequest?.summaryEn,
          severity: input.changeRequest?.severity,
          checklist: input.changeRequest?.checklist,
          ...(actor ? { actor } : {}),
        }),
      );

      const updated = await getKnowledgeVersionRepository().updateStatus(
        review.versionId,
        'CHANGES_REQUESTED',
      );

      await getGovernanceAuditService().recordStageChange({
        entityId: entity.id,
        versionId: review.versionId,
        fromStage,
        toStage: 'DRAFT',
        ...(actor ? { actor } : {}),
        reason: 'change_request',
      });

      return toKnowledgeVersionDto(updated);
    }

    // APPROVE — advance sub-stages or to vet/approval
    const nextStages = this.nextReviewStagesAfterApprove(review.stage, version.audience);
    for (const stage of nextStages) {
      const alreadyApproved = await getKnowledgeReviewRepository().hasApprovedStage(
        review.versionId,
        stage,
      );
      const alreadyOpen = (await getKnowledgeReviewRepository().listOpenForVersion(review.versionId, stage))
        .length;
      if (!alreadyApproved && !alreadyOpen) {
        await getKnowledgeReviewRepository().openReview({
          versionId: review.versionId,
          stage,
          queueSource: 'MANUAL',
        });
        await getGovernanceAuditService().record({
          eventType: 'REVIEW_OPENED',
          entityId: entity.id,
          versionId: review.versionId,
          ...(actor ? { actor } : {}),
          governanceStage: 'REVIEW',
          detail: { stage },
        });
      }
    }

    const allApproved = await this.allRequiredReviewsApproved(review.versionId, version.audience);
    if (!allApproved) {
      return toKnowledgeVersionDto(await getKnowledgeVersionRepository().requireVersion(review.versionId));
    }

    return this.advanceAfterReviewComplete(review.versionId, entity.id, actor);
  }

  private nextReviewStagesAfterApprove(
    completedStage: VkReviewStage,
    audience: string,
  ): VkReviewStage[] {
    const required = requiredReviewStages({ audience });
    const idx = required.indexOf(completedStage);
    if (idx < 0 || idx >= required.length - 1) return [];
    return required.slice(idx + 1);
  }

  private async allRequiredReviewsApproved(versionId: string, audience: string): Promise<boolean> {
    const required = requiredReviewStages({ audience });
    for (const stage of required) {
      const approved = await getKnowledgeReviewRepository().hasApprovedStage(versionId, stage);
      if (!approved) return false;
    }
    return true;
  }

  private async advanceAfterReviewComplete(
    versionId: string,
    entityId: string,
    actor?: GovernanceActor,
  ): Promise<KnowledgeVersionDto> {
    const version = await getKnowledgeVersionRepository().requireVersion(versionId);
    const entity = await getKnowledgeEntityRepository().requireEntity(entityId);
    const fromStage = await this.getGovernanceStage(versionId);

    await getConflictResolutionService().assertNoBlockingConflicts(versionId, ['C1']);

    if (requiresVetReviewPath({ clinicalRiskTier: version.clinicalRiskTier, domain: entity.domain })) {
      const openVet = await getKnowledgeReviewRepository().listOpenForVersion(versionId, 'VET');
      if (openVet.length === 0) {
        await getKnowledgeReviewRepository().openReview({
          versionId,
          stage: 'VET',
          queueSource: 'MANUAL',
        });
      }
      const updated = await getKnowledgeVersionRepository().updateStatus(versionId, 'VET_APPROVAL');
      await getGovernanceAuditService().recordStageChange({
        entityId,
        versionId,
        fromStage,
        toStage: 'VET_REVIEW',
        ...(actor ? { actor } : {}),
        reason: 'editorial_complete_requires_vet',
      });
      return toKnowledgeVersionDto(updated);
    }

    if (isExpeditedEligible({ clinicalRiskTier: version.clinicalRiskTier, domain: entity.domain })) {
      await getGovernanceAuditService().record({
        eventType: 'GOVERNANCE_APPROVAL_READY',
        entityId,
        versionId,
        ...(actor ? { actor } : {}),
        governanceStage: 'APPROVAL',
        detail: { approvalType: 'EDITORIAL_EXPEDITED' },
      });
      await getGovernanceAuditService().recordStageChange({
        entityId,
        versionId,
        fromStage,
        toStage: 'APPROVAL',
        ...(actor ? { actor } : {}),
        reason: 'expedited_domain_lead_approve',
      });
      return toKnowledgeVersionDto(
        await getKnowledgeVersionRepository().requireVersion(versionId),
      );
    }

    await getGovernanceAuditService().record({
      eventType: 'GOVERNANCE_APPROVAL_READY',
      entityId,
      versionId,
      ...(actor ? { actor } : {}),
      governanceStage: 'APPROVAL',
      detail: { approvalType: 'EDITORIAL_STANDARD' },
    });
    await getGovernanceAuditService().recordStageChange({
      entityId,
      versionId,
      fromStage,
      toStage: 'APPROVAL',
      ...(actor ? { actor } : {}),
      reason: 'editorial_complete',
    });

    return toKnowledgeVersionDto(await getKnowledgeVersionRepository().requireVersion(versionId));
  }

  async recordVetApproval(
    input: RecordGovernanceVetApprovalInput,
    actor?: GovernanceActor,
  ): Promise<KnowledgeVersionDto> {
    const version = await getKnowledgeVersionRepository().requireVersion(input.versionId);
    const entity = await getKnowledgeEntityRepository().requireEntity(version.entityId);

    if (version.status !== 'VET_APPROVAL') {
      throw new KnowledgeGovernanceError(
        'INVALID_STATUS',
        'Version is not in vet review stage',
      );
    }

    if (!assertVetScope({ domain: entity.domain, approvalScope: input.approvalScope })) {
      throw new KnowledgeGovernanceError(
        'VET_SCOPE_MISMATCH',
        `Vet approval scope must include domain ${entity.domain}`,
      );
    }

    const editorialReviewers = await getKnowledgeReviewRepository().listCompletedForVersion(
      input.versionId,
      'EDITORIAL',
    );
    if (editorialReviewers.some((r) => r.reviewerId === input.approverVetId)) {
      throw new KnowledgeGovernanceError(
        'SEPARATION_OF_DUTIES',
        'Vet approver cannot be the same as editorial reviewer',
      );
    }

    await getConflictResolutionService().assertNoBlockingConflicts(input.versionId, ['C5']);

    await getKnowledgeChunkingOrchestratorService().processVersion({
      versionId: input.versionId,
      finalizeEvidence: true,
      assessorId: input.approverVetId,
    });

    const versionAfter = await getKnowledgeVersionRepository().requireVersion(input.versionId);
    const citations = filterVersionLevelSignOffCitations(
      await getKnowledgeCitationRepository().listByVersion(input.versionId),
    );
    const signOffHash = computeVersionSignOffHash(versionAfter, citations);
    const validUntil =
      input.validUntil ??
      computeApprovalValidUntil({
        domain: entity.domain,
        clinicalRiskTier: versionAfter.clinicalRiskTier,
      });

    if (entity.domain === 'REGULATORY_BD' && input.dualApprovalRequired && !input.coApproverVetId) {
      throw new KnowledgeGovernanceError(
        'DUAL_APPROVAL_REQUIRED',
        'Regulatory content requires co-approver vet ID',
      );
    }

    await getKnowledgeApprovalRepository().create({
      ...input,
      signOffHash,
      validUntil,
      dualApprovalRequired: input.dualApprovalRequired ?? entity.domain === 'REGULATORY_BD',
    });

    const openVetReviews = await getKnowledgeReviewRepository().listOpenForVersion(input.versionId, 'VET');
    for (const vetReview of openVetReviews) {
      await getKnowledgeReviewRepository().completeReview({
        reviewId: vetReview.id,
        decision: 'APPROVE',
        reviewerId: input.approverVetId,
      });
    }

    const fromStage = await this.getGovernanceStage(input.versionId);

    await getGovernanceAuditService().record({
      eventType: 'APPROVAL_RECORDED',
      entityId: entity.id,
      versionId: input.versionId,
      ...(actor ? { actor } : {}),
      governanceStage: 'APPROVAL',
      detail: {
        approverVetId: input.approverVetId,
        signOffHash,
        validUntil: validUntil.toISOString(),
      },
    });

    await getGovernanceAuditService().recordStageChange({
      entityId: entity.id,
      versionId: input.versionId,
      fromStage,
      toStage: 'APPROVAL',
      ...(actor ? { actor } : {}),
      reason: 'vet_approval',
    });

    return toKnowledgeVersionDto(await getKnowledgeVersionRepository().requireVersion(input.versionId));
  }

  async publish(
    input: PublishGovernanceInput,
    actor?: GovernanceActor,
  ): Promise<KnowledgeVersionDto> {
    const versionId = input.versionId;
    const stage = await this.getGovernanceStage(versionId);

    if (stage !== 'APPROVAL') {
      throw new KnowledgeGovernanceError(
        'NOT_APPROVAL_READY',
        `Version governance stage is ${stage}; must be APPROVAL to publish`,
      );
    }

    try {
      await getConflictResolutionService().assertNoBlockingConflicts(versionId);
    } catch (err) {
      if (input.overrideReason && actor?.role === 'SUPER_ADMIN') {
        await getGovernanceAuditService().record({
          eventType: 'GOVERNANCE_OVERRIDE',
          versionId,
          ...(actor ? { actor } : {}),
          governanceStage: 'APPROVAL',
          detail: { reason: input.overrideReason, gate: 'CONFLICT_OPEN' },
        });
      } else {
        throw err;
      }
    }

    const version = await getKnowledgeVersionRepository().requireVersion(versionId);
    const entity = await getKnowledgeEntityRepository().requireEntity(version.entityId);

    if (requiresVetReviewPath({ clinicalRiskTier: version.clinicalRiskTier, domain: entity.domain })) {
      const approval = await getKnowledgeApprovalRepository().findLatestValid(versionId);
      if (!approval) {
        throw new KnowledgeGovernanceError('VET_APPROVAL_REQUIRED', 'Valid veterinary approval required');
      }
      const citations = filterVersionLevelSignOffCitations(
        await getKnowledgeCitationRepository().listByVersion(versionId),
      );
      const currentHash = computeVersionSignOffHash(version, citations);
      if (approval.signOffHash && approval.signOffHash !== currentHash) {
        throw new KnowledgeGovernanceError(
          'SIGNOFF_STALE',
          'Version content changed after veterinary sign-off',
        );
      }
      if (
        entity.domain === 'REGULATORY_BD' &&
        approval.dualApprovalRequired &&
        !approval.coApproverVetId
      ) {
        throw new KnowledgeGovernanceError(
          'DUAL_APPROVAL_INCOMPLETE',
          'Regulatory content requires co-approver veterinary sign-off',
        );
      }
    }

    const fromStage = stage;
    const result = await getKnowledgeFoundationService().publishVersion(versionId, actor);

    await getGovernanceAuditService().recordStageChange({
      entityId: version.entityId,
      versionId,
      fromStage,
      toStage: 'PUBLISHED',
      ...(actor ? { actor } : {}),
      reason: 'publish',
    });

    return result;
  }

  async archive(input: ArchiveGovernanceInput, actor?: GovernanceActor): Promise<KnowledgeVersionDto> {
    const version = await getKnowledgeVersionRepository().requireVersion(input.versionId);
    const fromStage = await this.getGovernanceStage(input.versionId);

    if (input.archiveType === 'REJECT') {
      if (version.status === 'PUBLISHED') {
        throw new KnowledgeGovernanceError('INVALID_ARCHIVE', 'Cannot reject published version; use emergency unpublish');
      }
      const updated = await getKnowledgeVersionRepository().updateStatus(input.versionId, 'REJECTED');
      await this.recordArchiveAudit(version.entityId, input, fromStage, actor);
      return toKnowledgeVersionDto(updated);
    }

    if (input.archiveType === 'EMERGENCY_UNPUBLISH') {
      if (version.status !== 'PUBLISHED') {
        throw new KnowledgeGovernanceError('INVALID_ARCHIVE', 'Emergency unpublish requires published status');
      }
      const updated = await getKnowledgeVersionRepository().updateStatus(input.versionId, 'DEPRECATED', {
        deprecatedAt: new Date(),
        deprecationReason: input.reason,
      });
      await getKnowledgeEntityRepository().updatePointers(version.entityId, {
        currentPublishedVersionId: null,
      });
      await getGovernanceAuditService().record({
        eventType: 'EMERGENCY_UNPUBLISH',
        entityId: version.entityId,
        versionId: input.versionId,
        ...(actor ? { actor } : {}),
        governanceStage: 'ARCHIVED',
        detail: { reason: input.reason },
      });
      await this.recordArchiveAudit(version.entityId, input, fromStage, actor);
      return toKnowledgeVersionDto(updated);
    }

    // DEPRECATE
    const updated = await getKnowledgeVersionRepository().updateStatus(input.versionId, 'DEPRECATED', {
      deprecatedAt: new Date(),
      deprecationReason: input.reason,
    });
    await this.recordArchiveAudit(version.entityId, input, fromStage, actor);
    return toKnowledgeVersionDto(updated);
  }

  private async recordArchiveAudit(
    entityId: string,
    input: ArchiveGovernanceInput,
    fromStage: GovernanceStage,
    actor?: GovernanceActor,
  ): Promise<void> {
    await getGovernanceAuditService().record({
      eventType: 'VERSION_ARCHIVED',
      entityId,
      versionId: input.versionId,
      ...(actor ? { actor } : {}),
      governanceStage: 'ARCHIVED',
      detail: { archiveType: input.archiveType, reason: input.reason },
    });
    await getGovernanceAuditService().recordStageChange({
      entityId,
      versionId: input.versionId,
      fromStage,
      toStage: 'ARCHIVED',
      ...(actor ? { actor } : {}),
      reason: input.archiveType.toLowerCase(),
    });
  }

  async resolveChangeRequestItem(
    input: ResolveChangeRequestItemInput,
    actor?: GovernanceActor,
  ): Promise<{ allRequiredResolved: boolean }> {
    const { getChangeRequestRepository } = await import('./repositories/change-request.repository.js');
    const row = await getChangeRequestRepository().findById(input.changeRequestId);
    if (!row) {
      throw new KnowledgeGovernanceError('CHANGE_REQUEST_NOT_FOUND', 'Change request not found');
    }
    const version = await getKnowledgeVersionRepository().requireVersion(row.versionId);
    return getChangeRequestService().resolveChecklistItem({
      changeRequestId: input.changeRequestId,
      code: input.code,
      entityId: version.entityId,
      versionId: row.versionId,
      ...(actor ? { actor } : {}),
    });
  }

  async resolveConflict(input: ResolveConflictInput, actor: GovernanceActor): Promise<void> {
    await getConflictResolutionService().resolveConflict(input, actor);
  }

  async listReviewQueue(): Promise<KnowledgeVersionDto[]> {
    const rows = await getKnowledgeVersionRepository().listEditorialQueue();
    return rows.map((r) => toKnowledgeVersionDto(r));
  }

  async listVetQueue(): Promise<KnowledgeVersionDto[]> {
    const rows = await getKnowledgeVersionRepository().listVetQueue();
    return rows.map((r) => toKnowledgeVersionDto(r));
  }

  async listApprovalQueue(): Promise<KnowledgeVersionDto[]> {
    const editorial = await getKnowledgeVersionRepository().listEditorialQueue();
    const vet = await getKnowledgeVersionRepository().listVetQueue();
    const combined = [...editorial, ...vet];
    const approvalReady: KnowledgeVersionDto[] = [];

    for (const row of combined) {
      const stage = await this.getGovernanceStage(row.id);
      if (stage === 'APPROVAL') {
        approvalReady.push(toKnowledgeVersionDto(row));
      }
    }

    return approvalReady;
  }
}

let service: KnowledgeGovernanceOrchestratorService | null = null;

export function getKnowledgeGovernanceOrchestratorService(): KnowledgeGovernanceOrchestratorService {
  if (!service) service = new KnowledgeGovernanceOrchestratorService();
  return service;
}

export function resetKnowledgeGovernanceOrchestratorServiceForTests(): void {
  service = null;
}
