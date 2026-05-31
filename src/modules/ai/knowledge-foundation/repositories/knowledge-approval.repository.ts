import { getPrisma } from '../../../../shared/database/prisma.js';
import type { RecordKnowledgeApprovalInput } from '../knowledge-foundation.types.js';

export class KnowledgeApprovalRepository {
  async listByVersion(versionId: string) {
    return getPrisma().vkKnowledgeApproval.findMany({
      where: { versionId },
      orderBy: { approvedAt: 'desc' },
    });
  }

  async create(input: RecordKnowledgeApprovalInput & { signOffHash: string }) {
    return getPrisma().vkKnowledgeApproval.create({
      data: {
        versionId: input.versionId,
        approverVetId: input.approverVetId,
        vetLicenseNo: input.vetLicenseNo,
        approvalScope: input.approvalScope,
        signOffHash: input.signOffHash,
        validUntil: input.validUntil ?? null,
        dualApprovalRequired: input.dualApprovalRequired ?? false,
        coApproverVetId: input.coApproverVetId ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async findLatestValid(versionId: string) {
    return getPrisma().vkKnowledgeApproval.findFirst({
      where: {
        versionId,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      orderBy: { approvedAt: 'desc' },
    });
  }
}

let repo: KnowledgeApprovalRepository | null = null;

export function getKnowledgeApprovalRepository(): KnowledgeApprovalRepository {
  if (!repo) repo = new KnowledgeApprovalRepository();
  return repo;
}

export function resetKnowledgeApprovalRepositoryForTests(): void {
  repo = null;
}
