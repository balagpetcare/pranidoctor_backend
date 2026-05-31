import { getPrisma } from '../../../../shared/database/prisma.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { KnowledgeSourceNotFoundError } from '../../knowledge-ingestion/knowledge-ingestion.errors.js';
import type { CreateKnowledgeSourceInput } from '../knowledge-foundation.types.js';

export class KnowledgeSourceRepository {
  async findById(id: string) {
    return getPrisma().aiKnowledgeSource.findUnique({
      where: { id },
      include: {
        license: true,
        documents: { orderBy: { ingestedAt: 'desc' }, take: 20 },
      },
    });
  }

  async findByKey(sourceKey: string) {
    return getPrisma().aiKnowledgeSource.findUnique({ where: { sourceKey } });
  }

  async list(filters?: { status?: string }) {
    return getPrisma().aiKnowledgeSource.findMany({
      where: omitUndefined({ status: filters?.status as never }),
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async create(input: CreateKnowledgeSourceInput) {
    return getPrisma().aiKnowledgeSource.create({
      data: {
        sourceKey: input.sourceKey,
        sourceClass: input.sourceClass,
        sourceType: input.sourceType,
        titleBn: input.titleBn,
        titleEn: input.titleEn,
        publisher: input.publisher ?? null,
        publishYear: input.publishYear ?? null,
        edition: input.edition ?? null,
        jurisdiction: input.jurisdiction ?? 'BD',
        trustTier: input.trustTier ?? 2,
        allowedDomains: (input.allowedDomains ?? []) as never,
        licenseId: input.licenseId ?? null,
      },
    });
  }

  async update(id: string, input: Partial<CreateKnowledgeSourceInput>) {
    await this.require(id);
    return getPrisma().aiKnowledgeSource.update({
      where: { id },
      data: omitUndefined({
        titleBn: input.titleBn,
        titleEn: input.titleEn,
        publisher: input.publisher,
        publishYear: input.publishYear,
        edition: input.edition,
        jurisdiction: input.jurisdiction,
        trustTier: input.trustTier,
        allowedDomains: input.allowedDomains as never,
        licenseId: input.licenseId,
      }),
    });
  }

  async require(id: string) {
    const row = await this.findById(id);
    if (!row) throw new KnowledgeSourceNotFoundError(id);
    return row;
  }
}

let repo: KnowledgeSourceRepository | null = null;

export function getKnowledgeSourceRepository(): KnowledgeSourceRepository {
  if (!repo) repo = new KnowledgeSourceRepository();
  return repo;
}

export function resetKnowledgeSourceRepositoryForTests(): void {
  repo = null;
}
