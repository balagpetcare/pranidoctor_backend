import type {
  AiKnowledgeEvidenceLevel,
  VkEvidenceAssessmentMethod,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';

export class KnowledgeEvidenceRepository {
  async append(params: {
    versionId: string;
    evidenceLevel: AiKnowledgeEvidenceLevel;
    assessmentMethod: VkEvidenceAssessmentMethod;
    rationaleBn?: string;
    rationaleEn?: string;
    assessorId?: string;
    provisional: boolean;
    supersedesEvidenceId?: string;
  }) {
    return getPrisma().vkKnowledgeEvidence.create({
      data: {
        versionId: params.versionId,
        evidenceLevel: params.evidenceLevel,
        assessmentMethod: params.assessmentMethod,
        rationaleBn: params.rationaleBn ?? null,
        rationaleEn: params.rationaleEn ?? null,
        assessorId: params.assessorId ?? null,
        provisional: params.provisional,
        supersedesEvidenceId: params.supersedesEvidenceId ?? null,
      },
    });
  }

  async findLatest(versionId: string) {
    return getPrisma().vkKnowledgeEvidence.findFirst({
      where: { versionId },
      orderBy: { assessedAt: 'desc' },
    });
  }
}

let repo: KnowledgeEvidenceRepository | null = null;

export function getKnowledgeEvidenceRepository(): KnowledgeEvidenceRepository {
  if (!repo) repo = new KnowledgeEvidenceRepository();
  return repo;
}

export function resetKnowledgeEvidenceRepositoryForTests(): void {
  repo = null;
}
