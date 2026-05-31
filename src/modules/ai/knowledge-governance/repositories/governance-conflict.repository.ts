import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';

export class GovernanceConflictRepository {
  async create(params: {
    versionId: string;
    conflictType: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
    openedById: string;
    assignedToId?: string;
    detail?: Record<string, unknown>;
  }) {
    return getPrisma().vkGovernanceConflict.create({
      data: {
        versionId: params.versionId,
        conflictType: params.conflictType,
        openedById: params.openedById,
        assignedToId: params.assignedToId ?? null,
        ...(params.detail ? { detailJson: toInputJson(params.detail) } : {}),
      },
    });
  }

  async findById(id: string) {
    return getPrisma().vkGovernanceConflict.findUnique({ where: { id } });
  }

  async listOpenForVersion(versionId: string) {
    return getPrisma().vkGovernanceConflict.findMany({
      where: { versionId, status: { in: ['OPEN', 'ESCALATED'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async hasBlockingConflict(versionId: string): Promise<boolean> {
    const count = await getPrisma().vkGovernanceConflict.count({
      where: { versionId, status: { in: ['OPEN', 'ESCALATED'] } },
    });
    return count > 0;
  }

  async resolve(params: {
    id: string;
    decision: string;
    rationale: string;
    resolvedById: string;
    status?: 'RESOLVED' | 'OVERRIDDEN';
  }) {
    return getPrisma().vkGovernanceConflict.update({
      where: { id: params.id },
      data: {
        status: params.status ?? 'RESOLVED',
        resolutionJson: toInputJson({
          decision: params.decision,
          rationale: params.rationale,
          resolvedById: params.resolvedById,
          resolvedAt: new Date().toISOString(),
        }),
      },
    });
  }
}

let repo: GovernanceConflictRepository | null = null;

export function getGovernanceConflictRepository(): GovernanceConflictRepository {
  if (!repo) repo = new GovernanceConflictRepository();
  return repo;
}

export function resetGovernanceConflictRepositoryForTests(): void {
  repo = null;
}
