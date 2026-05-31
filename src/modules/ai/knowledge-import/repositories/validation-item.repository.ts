import type { AiKnowledgeValidationItemStatus } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';

export class ValidationItemRepository {
  async createBatch(
    importRunId: string,
    items: Array<{ extractIndex: number; payloadJson: Record<string, unknown> }>,
  ) {
    if (items.length === 0) return [];
    await getPrisma().aiKnowledgeValidationItem.createMany({
      data: items.map((item) => ({
        importRunId,
        extractIndex: item.extractIndex,
        payloadJson: toInputJson(item.payloadJson),
        status: 'PENDING' as AiKnowledgeValidationItemStatus,
        failureCodes: [],
      })),
    });
    return getPrisma().aiKnowledgeValidationItem.findMany({ where: { importRunId } });
  }

  async markResult(
    id: string,
    status: AiKnowledgeValidationItemStatus,
    failureCodes: string[] = [],
    waivedById?: string,
  ) {
    return getPrisma().aiKnowledgeValidationItem.update({
      where: { id },
      data: {
        status,
        failureCodes,
        ...(waivedById ? { waivedById } : {}),
      },
    });
  }

  async listPending(importRunId: string) {
    return getPrisma().aiKnowledgeValidationItem.findMany({
      where: { importRunId, status: 'PENDING' },
      orderBy: { extractIndex: 'asc' },
    });
  }

  async markByExtractIndex(
    importRunId: string,
    extractIndex: number,
    status: AiKnowledgeValidationItemStatus,
    failureCodes: string[] = [],
  ) {
    const item = await getPrisma().aiKnowledgeValidationItem.findFirst({
      where: { importRunId, extractIndex },
    });
    if (!item) return null;
    return this.markResult(item.id, status, failureCodes);
  }
}

let repo: ValidationItemRepository | null = null;

export function getValidationItemRepository(): ValidationItemRepository {
  if (!repo) repo = new ValidationItemRepository();
  return repo;
}

export function resetValidationItemRepositoryForTests(): void {
  repo = null;
}
