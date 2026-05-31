import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type { AiKnowledgeReviewDecision, VkReviewStage } from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { KnowledgeReviewNotFoundError } from '../knowledge-foundation.errors.js';

export class KnowledgeReviewRepository {
  async findById(id: string) {
    return getPrisma().vkKnowledgeReview.findUnique({
      where: { id },
      include: { version: { include: { entity: true } } },
    });
  }

  async openReview(params: {
    versionId: string;
    stage: VkReviewStage;
    reviewerId?: string;
    queueSource?: string;
    importRunId?: string;
  }) {
    return getPrisma().vkKnowledgeReview.create({
      data: {
        versionId: params.versionId,
        stage: params.stage,
        reviewerId: params.reviewerId ?? null,
        queueSource: params.queueSource ?? 'MANUAL',
        importRunId: params.importRunId ?? null,
      },
    });
  }

  async completeReview(params: {
    reviewId: string;
    decision: AiKnowledgeReviewDecision;
    reviewerId: string;
    comments?: string;
    checklistJson?: Record<string, unknown>;
  }) {
    const review = await this.findById(params.reviewId);
    if (!review) throw new KnowledgeReviewNotFoundError(params.reviewId);

    return getPrisma().vkKnowledgeReview.update({
      where: { id: params.reviewId },
      data: omitUndefined({
        decision: params.decision,
        reviewerId: params.reviewerId,
        comments: params.comments ?? null,
        checklistJson: params.checklistJson ? toInputJson(params.checklistJson) : undefined,
        completedAt: new Date(),
      }),
    });
  }

  async listOpenForVersion(versionId: string, stage?: VkReviewStage) {
    return getPrisma().vkKnowledgeReview.findMany({
      where: {
        versionId,
        completedAt: null,
        ...(stage ? { stage } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async listCompletedForVersion(versionId: string, stage?: VkReviewStage) {
    return getPrisma().vkKnowledgeReview.findMany({
      where: {
        versionId,
        completedAt: { not: null },
        decision: 'APPROVE',
        ...(stage ? { stage } : {}),
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async hasApprovedStage(versionId: string, stage: VkReviewStage): Promise<boolean> {
    const row = await getPrisma().vkKnowledgeReview.findFirst({
      where: {
        versionId,
        stage,
        decision: 'APPROVE',
        completedAt: { not: null },
      },
    });
    return row != null;
  }
}

let repo: KnowledgeReviewRepository | null = null;

export function getKnowledgeReviewRepository(): KnowledgeReviewRepository {
  if (!repo) repo = new KnowledgeReviewRepository();
  return repo;
}

export function resetKnowledgeReviewRepositoryForTests(): void {
  repo = null;
}
