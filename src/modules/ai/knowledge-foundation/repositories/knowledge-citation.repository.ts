import { getPrisma } from '../../../../shared/database/prisma.js';
import { KnowledgeCitationNotFoundError } from '../knowledge-foundation.errors.js';
import type { AddKnowledgeCitationInput } from '../knowledge-foundation.types.js';

export class KnowledgeCitationRepository {
  async findById(id: string) {
    return getPrisma().vkKnowledgeCitation.findUnique({ where: { id } });
  }

  async listByVersion(versionId: string) {
    return getPrisma().vkKnowledgeCitation.findMany({
      where: { versionId },
      include: { source: true, document: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(versionId: string, input: AddKnowledgeCitationInput & { inlineCitationKey: string }) {
    return getPrisma().vkKnowledgeCitation.create({
      data: {
        versionId,
        sourceId: input.sourceId,
        documentId: input.documentId ?? null,
        pageRef: input.pageRef ?? null,
        sectionRef: input.sectionRef ?? null,
        tableRef: input.tableRef ?? null,
        rowRef: input.rowRef ?? null,
        contributionWeight: input.contributionWeight ?? 1,
        quotedFrom: input.quotedFrom ?? false,
        inlineCitationKey: input.inlineCitationKey,
        humanCitationBn: input.humanCitationBn ?? null,
        humanCitationEn: input.humanCitationEn ?? null,
      },
      include: { source: true },
    });
  }

  async delete(id: string) {
    const row = await getPrisma().vkKnowledgeCitation.findUnique({ where: { id } });
    if (!row) throw new KnowledgeCitationNotFoundError(id);
    await getPrisma().vkKnowledgeCitation.delete({ where: { id } });
    return row;
  }

  async countByVersion(versionId: string) {
    return getPrisma().vkKnowledgeCitation.count({ where: { versionId } });
  }
}

let repo: KnowledgeCitationRepository | null = null;

export function getKnowledgeCitationRepository(): KnowledgeCitationRepository {
  if (!repo) repo = new KnowledgeCitationRepository();
  return repo;
}

export function resetKnowledgeCitationRepositoryForTests(): void {
  repo = null;
}
