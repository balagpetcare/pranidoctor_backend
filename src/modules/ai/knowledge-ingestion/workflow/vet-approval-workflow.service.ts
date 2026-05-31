import { createHash } from 'node:crypto';

import {
  AiKnowledgeReviewDecision,
  AiKnowledgeReviewStage,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { NotFoundError } from '../../../../shared/errors/http.errors.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { KnowledgeEntryWorkflowError } from '../knowledge-ingestion.errors.js';
import type { VetApprovalInput } from '../knowledge-ingestion.types.js';
import { finalizeEvidenceLevel } from '../scoring/evidence-level.engine.js';
import { computeConfidenceScore } from '../scoring/confidence.engine.js';

export class KnowledgeVetApprovalWorkflowService {
  readonly name = 'KnowledgeVetApprovalWorkflowService';

  async openVetQueue(knowledgeEntryId: string, requestedById?: string) {
    await this.requireEntry(knowledgeEntryId, AiKnowledgeStatus.VET_APPROVAL);

    return getPrisma().aiKnowledgeReview.create({
      data: {
        knowledgeEntryId,
        stage: AiKnowledgeReviewStage.VET,
        reviewerId: requestedById ?? null,
        queueSource: 'INGESTION',
      },
    });
  }

  async listVetQueue(limit = 50) {
    return getPrisma().aiKnowledgeEntry.findMany({
      where: { status: AiKnowledgeStatus.VET_APPROVAL },
      orderBy: [{ clinicalRiskTier: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
      include: {
        source: true,
        chunks: { where: { stage: 'STAGING' }, orderBy: { chunkIndex: 'asc' } },
        reviews: {
          where: { stage: AiKnowledgeReviewStage.VET, completedAt: null },
          take: 1,
        },
      },
    });
  }

  async completeVetApproval(input: VetApprovalInput) {
    const entry = await this.requireEntry(input.knowledgeEntryId, AiKnowledgeStatus.VET_APPROVAL);

    const review = await getPrisma().aiKnowledgeReview.findFirst({
      where: {
        knowledgeEntryId: entry.id,
        stage: AiKnowledgeReviewStage.VET,
        completedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!review) {
      throw new KnowledgeEntryWorkflowError('VET_REVIEW_NOT_FOUND', 'No open vet review');
    }

    await getPrisma().aiKnowledgeReview.update({
      where: { id: review.id },
      data: {
        decision: input.decision as AiKnowledgeReviewDecision,
        reviewerId: input.approverVetId,
        comments: input.notes ?? null,
        completedAt: new Date(),
      },
    });

    if (input.decision === 'REJECT') {
      return getPrisma().aiKnowledgeEntry.update({
        where: { id: entry.id },
        data: {
          status: AiKnowledgeStatus.REJECTED,
          approvedByVetId: input.approverVetId,
        },
      });
    }

    if (input.decision === 'REQUEST_CHANGES') {
      return getPrisma().aiKnowledgeEntry.update({
        where: { id: entry.id },
        data: {
          status: AiKnowledgeStatus.CHANGES_REQUESTED,
          approvedByVetId: input.approverVetId,
        },
      });
    }

    const evidenceLevel = finalizeEvidenceLevel({
      provisional: entry.provisionalEvidenceLevel ?? 'L2',
      clinicalRiskTier: entry.clinicalRiskTier,
      ...(input.evidenceLevel ? { reviewerLevel: input.evidenceLevel } : {}),
    });

    const source = entry.sourceId
      ? await getPrisma().aiKnowledgeSource.findUnique({ where: { id: entry.sourceId } })
      : null;

    const confidenceScore = computeConfidenceScore({
      evidenceLevel,
      trustTier: source?.trustTier ?? 2,
      reviewCompletenessScore: 1,
      graphConnectivityScore: 0.5,
      lastReviewedAt: new Date(),
      provisional: false,
    });

    const signOffHash = createHash('sha256')
      .update(`${entry.id}:${input.approverVetId}:${Date.now()}`)
      .digest('hex');

    const validUntil =
      input.validUntilDays != null
        ? new Date(Date.now() + input.validUntilDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    await getPrisma().aiKnowledgeApproval.create({
      data: {
        knowledgeEntryId: entry.id,
        approverVetId: input.approverVetId,
        vetLicenseNo: input.vetLicenseNo ?? null,
        signOffHash,
        validUntil,
        notes: input.notes ?? null,
      },
    });

    return getPrisma().aiKnowledgeEntry.update({
      where: { id: entry.id },
      data: omitUndefined({
        status: AiKnowledgeStatus.DRAFT,
        approvedByVetId: input.approverVetId,
        evidenceLevel,
        confidenceScore,
        provisionalConfidenceScore: confidenceScore,
      }),
    });
  }

  private async requireEntry(id: string, expectedStatus?: AiKnowledgeStatus) {
    const entry = await getPrisma().aiKnowledgeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('KNOWLEDGE_ENTRY_NOT_FOUND', 'Knowledge entry not found');
    if (expectedStatus && entry.status !== expectedStatus) {
      throw new KnowledgeEntryWorkflowError(
        'INVALID_STATUS',
        `Expected status ${expectedStatus}, got ${entry.status}`,
      );
    }
    return entry;
  }
}

let vetService: KnowledgeVetApprovalWorkflowService | null = null;

export function getKnowledgeVetApprovalWorkflowService(): KnowledgeVetApprovalWorkflowService {
  if (!vetService) vetService = new KnowledgeVetApprovalWorkflowService();
  return vetService;
}

export function resetKnowledgeVetApprovalWorkflowForTests(): void {
  vetService = null;
}
