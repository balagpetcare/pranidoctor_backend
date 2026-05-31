import {
  AiKnowledgeReviewDecision,
  AiKnowledgeReviewStage,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { NotFoundError } from '../../../../shared/errors/http.errors.js';
import { KnowledgeEntryWorkflowError } from '../knowledge-ingestion.errors.js';
import type { EditorialReviewInput } from '../knowledge-ingestion.types.js';
import { finalizeEvidenceLevel } from '../scoring/evidence-level.engine.js';
import { getKnowledgeVetApprovalWorkflowService } from './vet-approval-workflow.service.js';

export class KnowledgeEditorialWorkflowService {
  readonly name = 'KnowledgeEditorialWorkflowService';

  async submitToEditorial(params: {
    knowledgeEntryId: string;
    reviewerId?: string;
    queueSource?: string;
    importRunId?: string;
  }) {
    const entry = await this.requireEntry(params.knowledgeEntryId);
    if (entry.status !== AiKnowledgeStatus.DRAFT && entry.status !== AiKnowledgeStatus.CHANGES_REQUESTED) {
      throw new KnowledgeEntryWorkflowError(
        'INVALID_STATUS',
        `Cannot submit entry in status ${entry.status}`,
      );
    }

    await getPrisma().aiKnowledgeEntry.update({
      where: { id: entry.id },
      data: { status: AiKnowledgeStatus.IN_REVIEW },
    });

    await getPrisma().aiKnowledgeReview.updateMany({
      where: {
        knowledgeEntryId: entry.id,
        stage: AiKnowledgeReviewStage.EDITORIAL,
        completedAt: null,
      },
      data: {
        decision: AiKnowledgeReviewDecision.REQUEST_CHANGES,
        comments: 'Superseded by a new editorial submission',
        completedAt: new Date(),
      },
    });

    return getPrisma().aiKnowledgeReview.create({
      data: {
        knowledgeEntryId: entry.id,
        stage: AiKnowledgeReviewStage.EDITORIAL,
        reviewerId: params.reviewerId ?? null,
        queueSource: params.queueSource ?? 'MANUAL',
        importRunId: params.importRunId ?? null,
      },
    });
  }

  async listEditorialQueue(limit = 50) {
    return getPrisma().aiKnowledgeEntry.findMany({
      where: { status: AiKnowledgeStatus.IN_REVIEW },
      orderBy: [{ clinicalRiskTier: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
      include: {
        source: true,
        reviews: {
          where: { stage: AiKnowledgeReviewStage.EDITORIAL, completedAt: null },
          take: 1,
        },
      },
    });
  }

  async completeEditorialReview(input: EditorialReviewInput) {
    const entry = await this.requireEntry(input.knowledgeEntryId);
    if (entry.status !== AiKnowledgeStatus.IN_REVIEW) {
      throw new KnowledgeEntryWorkflowError('INVALID_STATUS', 'Entry is not in editorial review');
    }

    const review = await getPrisma().aiKnowledgeReview.findFirst({
      where: {
        knowledgeEntryId: entry.id,
        stage: AiKnowledgeReviewStage.EDITORIAL,
        completedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!review) {
      throw new KnowledgeEntryWorkflowError('REVIEW_NOT_FOUND', 'No open editorial review');
    }

    await getPrisma().aiKnowledgeReview.update({
      where: { id: review.id },
      data: {
        decision: input.decision as AiKnowledgeReviewDecision,
        reviewerId: input.reviewerId,
        comments: input.comments ?? null,
        ...(input.checklistJson ? { checklistJson: toInputJson(input.checklistJson) } : {}),
        completedAt: new Date(),
      },
    });

    if (input.decision === 'REJECT') {
      return getPrisma().aiKnowledgeEntry.update({
        where: { id: entry.id },
        data: { status: AiKnowledgeStatus.REJECTED, reviewedById: input.reviewerId },
      });
    }

    if (input.decision === 'REQUEST_CHANGES') {
      return getPrisma().aiKnowledgeEntry.update({
        where: { id: entry.id },
        data: { status: AiKnowledgeStatus.CHANGES_REQUESTED, reviewedById: input.reviewerId },
      });
    }

    const evidenceLevel =
      input.evidenceLevel ??
      finalizeEvidenceLevel({
        provisional: entry.provisionalEvidenceLevel ?? 'L2',
        clinicalRiskTier: entry.clinicalRiskTier,
      });

    const needsVet =
      entry.clinicalRiskTier === 'HIGH' ||
      entry.clinicalRiskTier === 'CRITICAL' ||
      entry.contentType === 'MEDICINE' ||
      entry.contentType === 'EMERGENCY';

    const updated = await getPrisma().aiKnowledgeEntry.update({
      where: { id: entry.id },
      data: {
        status: needsVet ? AiKnowledgeStatus.VET_APPROVAL : AiKnowledgeStatus.DRAFT,
        reviewedById: input.reviewerId,
        provisionalEvidenceLevel: evidenceLevel,
      },
    });

    if (needsVet) {
      await getKnowledgeVetApprovalWorkflowService().openVetQueue(entry.id, input.reviewerId);
    }

    return updated;
  }

  private async requireEntry(id: string) {
    const entry = await getPrisma().aiKnowledgeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('KNOWLEDGE_ENTRY_NOT_FOUND', 'Knowledge entry not found');
    return entry;
  }
}

let editorialService: KnowledgeEditorialWorkflowService | null = null;

export function getKnowledgeEditorialWorkflowService(): KnowledgeEditorialWorkflowService {
  if (!editorialService) editorialService = new KnowledgeEditorialWorkflowService();
  return editorialService;
}

export function resetKnowledgeEditorialWorkflowForTests(): void {
  editorialService = null;
}
