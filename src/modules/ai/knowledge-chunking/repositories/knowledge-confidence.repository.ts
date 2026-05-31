import type { VkConfidenceComputedBy } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';

export class KnowledgeConfidenceRepository {
  async append(params: {
    versionId: string;
    score: number;
    formulaVersion: string;
    componentsJson: Record<string, unknown>;
    provisional: boolean;
    computedBy: VkConfidenceComputedBy;
    meetsProfileGatesJson?: Record<string, boolean>;
  }) {
    return getPrisma().vkKnowledgeConfidence.create({
      data: {
        versionId: params.versionId,
        score: params.score,
        formulaVersion: params.formulaVersion,
        componentsJson: toInputJson(params.componentsJson),
        provisional: params.provisional,
        computedBy: params.computedBy,
        ...(params.meetsProfileGatesJson != null
          ? { meetsProfileGatesJson: toInputJson(params.meetsProfileGatesJson) }
          : {}),
      },
    });
  }

  async findLatest(versionId: string) {
    return getPrisma().vkKnowledgeConfidence.findFirst({
      where: { versionId },
      orderBy: { computedAt: 'desc' },
    });
  }
}

let repo: KnowledgeConfidenceRepository | null = null;

export function getKnowledgeConfidenceRepository(): KnowledgeConfidenceRepository {
  if (!repo) repo = new KnowledgeConfidenceRepository();
  return repo;
}

export function resetKnowledgeConfidenceRepositoryForTests(): void {
  repo = null;
}
