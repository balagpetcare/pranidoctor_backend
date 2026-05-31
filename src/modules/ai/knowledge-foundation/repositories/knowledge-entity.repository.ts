import { getPrisma } from '../../../../shared/database/prisma.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import type { CreateKnowledgeEntityInput } from '../knowledge-foundation.types.js';
import { KnowledgeEntityNotFoundError } from '../knowledge-foundation.errors.js';

export class KnowledgeEntityRepository {
  async findById(id: string) {
    return getPrisma().vkKnowledgeEntity.findUnique({
      where: { id },
      include: {
        publishedVersion: true,
        draftVersion: true,
      },
    });
  }

  async findBySlug(slug: string) {
    return getPrisma().vkKnowledgeEntity.findUnique({ where: { slug } });
  }

  async list(params?: { domain?: string; limit?: number }) {
    return getPrisma().vkKnowledgeEntity.findMany({
      where: omitUndefined({ domain: params?.domain as never }),
      orderBy: { updatedAt: 'desc' },
      take: params?.limit ?? 100,
    });
  }

  async createWithInitialVersion(
    input: CreateKnowledgeEntityInput,
    searchText: string,
  ) {
    return getPrisma().$transaction(async (tx) => {
      const entity = await tx.vkKnowledgeEntity.create({
        data: {
          domain: input.domain,
          entityType: input.entityType,
          slug: input.slug,
          legacyEntryId: input.legacyEntryId ?? null,
          createdById: input.createdById ?? null,
        },
      });

      const version = await tx.vkKnowledgeVersion.create({
        data: {
          entityId: entity.id,
          versionNumber: 1,
          status: 'DRAFT',
          titleBn: input.titleBn,
          titleEn: input.titleEn,
          summaryBn: input.summaryBn ?? null,
          summaryEn: input.summaryEn ?? null,
          bodyBn: input.bodyBn,
          bodyEn: input.bodyEn,
          species: input.species ?? [],
          audience: input.audience ?? 'FARMER',
          regionScope: input.regionScope ?? 'BD',
          clinicalRiskTier: input.clinicalRiskTier ?? 'LOW',
          searchText,
          createdById: input.createdById ?? null,
        },
      });

      await tx.vkKnowledgeEntity.update({
        where: { id: entity.id },
        data: { currentDraftVersionId: version.id },
      });

      return { entity, version };
    });
  }

  async updatePointers(
    entityId: string,
    pointers: { currentDraftVersionId?: string | null; currentPublishedVersionId?: string | null },
  ) {
    return getPrisma().vkKnowledgeEntity.update({
      where: { id: entityId },
      data: omitUndefined(pointers),
    });
  }

  async requireEntity(id: string) {
    const row = await this.findById(id);
    if (!row) throw new KnowledgeEntityNotFoundError(id);
    return row;
  }
}

let repo: KnowledgeEntityRepository | null = null;

export function getKnowledgeEntityRepository(): KnowledgeEntityRepository {
  if (!repo) repo = new KnowledgeEntityRepository();
  return repo;
}

export function resetKnowledgeEntityRepositoryForTests(): void {
  repo = null;
}
