import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type { VkReviewStage } from '../../../../generated/prisma/index.js';
import type { ChangeRequestChecklistItem } from '../knowledge-governance.types.js';

export class ChangeRequestRepository {
  async create(params: {
    versionId: string;
    reviewId: string;
    stage: VkReviewStage;
    requestedById: string;
    summaryBn?: string;
    summaryEn?: string;
    severity: 'MINOR' | 'MAJOR' | 'BLOCKING';
    checklist: ChangeRequestChecklistItem[];
    dueAt?: Date;
  }) {
    return getPrisma().vkKnowledgeChangeRequest.create({
      data: {
        versionId: params.versionId,
        reviewId: params.reviewId,
        stage: params.stage,
        requestedById: params.requestedById,
        summaryBn: params.summaryBn ?? null,
        summaryEn: params.summaryEn ?? null,
        severity: params.severity,
        checklistJson: toInputJson(params.checklist),
        dueAt: params.dueAt ?? null,
      },
    });
  }

  async findById(id: string) {
    return getPrisma().vkKnowledgeChangeRequest.findUnique({ where: { id } });
  }

  async listOpenForVersion(versionId: string) {
    return getPrisma().vkKnowledgeChangeRequest.findMany({
      where: { versionId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateChecklist(id: string, checklist: ChangeRequestChecklistItem[]) {
    return getPrisma().vkKnowledgeChangeRequest.update({
      where: { id },
      data: { checklistJson: toInputJson(checklist) },
    });
  }

  async markResolved(id: string) {
    return getPrisma().vkKnowledgeChangeRequest.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}

let repo: ChangeRequestRepository | null = null;

export function getChangeRequestRepository(): ChangeRequestRepository {
  if (!repo) repo = new ChangeRequestRepository();
  return repo;
}

export function resetChangeRequestRepositoryForTests(): void {
  repo = null;
}
