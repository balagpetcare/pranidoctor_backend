import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { KnowledgeVersionNotFoundError } from '../knowledge-foundation.errors.js';
import type { UpdateKnowledgeVersionDraftInput } from '../knowledge-foundation.types.js';
import type { VkVersionStatus, VkKnowledgeVersion } from '../../../../generated/prisma/index.js';

export class KnowledgeVersionRepository {
  async findById(id: string) {
    return getPrisma().vkKnowledgeVersion.findUnique({
      where: { id },
      include: {
        entity: true,
        citations: { include: { source: true } },
        reviews: { orderBy: { startedAt: 'desc' }, take: 10 },
        approvals: { orderBy: { approvedAt: 'desc' }, take: 5 },
        _count: { select: { citations: true } },
      },
    });
  }

  async findPlainById(id: string) {
    return getPrisma().vkKnowledgeVersion.findUnique({ where: { id } });
  }

  async listByEntity(entityId: string) {
    return getPrisma().vkKnowledgeVersion.findMany({
      where: { entityId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async listEditorialQueue(limit = 50) {
    return getPrisma().vkKnowledgeVersion.findMany({
      where: { status: 'IN_REVIEW' },
      orderBy: [{ clinicalRiskTier: 'desc' }, { submittedAt: 'asc' }],
      take: limit,
      include: { entity: true, _count: { select: { citations: true } } },
    });
  }

  async listVetQueue(limit = 50) {
    return getPrisma().vkKnowledgeVersion.findMany({
      where: { status: 'VET_APPROVAL' },
      orderBy: [{ clinicalRiskTier: 'desc' }, { submittedAt: 'asc' }],
      take: limit,
      include: { entity: true, _count: { select: { citations: true } } },
    });
  }

  async updateDraft(id: string, data: UpdateKnowledgeVersionDraftInput & { searchText?: string }) {
    return getPrisma().vkKnowledgeVersion.update({
      where: { id },
      data: omitUndefined({
        titleBn: data.titleBn,
        titleEn: data.titleEn,
        summaryBn: data.summaryBn,
        summaryEn: data.summaryEn,
        bodyBn: data.bodyBn,
        bodyEn: data.bodyEn,
        species: data.species,
        audience: data.audience,
        regionScope: data.regionScope,
        structuredJson: data.structuredJson ? toInputJson(data.structuredJson) : undefined,
        keywordsBn: data.keywordsBn,
        keywordsEn: data.keywordsEn,
        colloquialBn: data.colloquialBn,
        clinicalRiskTier: data.clinicalRiskTier,
        changeSummary: data.changeSummary,
        searchText: data.searchText,
      }),
    });
  }

  async updateStatus(
    id: string,
    status: VkVersionStatus,
    extra?: {
      submittedAt?: Date;
      publishedAt?: Date;
      publishedById?: string;
      deprecatedAt?: Date;
      deprecationReason?: string;
    },
  ) {
    return getPrisma().vkKnowledgeVersion.update({
      where: { id },
      data: {
        status,
        ...omitUndefined(extra ?? {}),
      },
    });
  }

  async forkDraft(params: {
    entityId: string;
    fromVersion: VkKnowledgeVersion;
    createdById?: string;
  }) {
    return getPrisma().$transaction(async (tx) => {
      const nextNumber = params.fromVersion.versionNumber + 1;
      const version = await tx.vkKnowledgeVersion.create({
        data: {
          entityId: params.entityId,
          versionNumber: nextNumber,
          supersedesVersionId: params.fromVersion.id,
          status: 'DRAFT',
          titleBn: params.fromVersion.titleBn,
          titleEn: params.fromVersion.titleEn,
          summaryBn: params.fromVersion.summaryBn,
          summaryEn: params.fromVersion.summaryEn,
          bodyBn: params.fromVersion.bodyBn,
          bodyEn: params.fromVersion.bodyEn,
          species: params.fromVersion.species,
          audience: params.fromVersion.audience,
          regionScope: params.fromVersion.regionScope,
          ...(params.fromVersion.structuredJson != null
            ? { structuredJson: params.fromVersion.structuredJson }
            : {}),
          keywordsBn: params.fromVersion.keywordsBn,
          keywordsEn: params.fromVersion.keywordsEn,
          colloquialBn: params.fromVersion.colloquialBn,
          ...(params.fromVersion.searchText != null
            ? { searchText: params.fromVersion.searchText }
            : {}),
          ...(params.fromVersion.chunkPolicyId != null
            ? { chunkPolicyId: params.fromVersion.chunkPolicyId }
            : {}),
          clinicalRiskTier: params.fromVersion.clinicalRiskTier,
          aiGeneratedDraft: params.fromVersion.aiGeneratedDraft,
          createdById: params.createdById ?? null,
        },
      });

      const citations = await tx.vkKnowledgeCitation.findMany({
        where: { versionId: params.fromVersion.id },
      });
      if (citations.length > 0) {
        await tx.vkKnowledgeCitation.createMany({
          data: citations.map((c) => {
            const row = {
              versionId: version.id,
              sourceId: c.sourceId,
              documentId: c.documentId,
              pageRef: c.pageRef,
              sectionRef: c.sectionRef,
              tableRef: c.tableRef,
              rowRef: c.rowRef,
              contributionWeight: c.contributionWeight,
              quotedFrom: c.quotedFrom,
              inlineCitationKey: c.inlineCitationKey,
              humanCitationBn: c.humanCitationBn,
              humanCitationEn: c.humanCitationEn,
            };
            if (c.spanRefsJson != null) {
              return { ...row, spanRefsJson: c.spanRefsJson };
            }
            return row;
          }),
        });
      }

      await tx.vkKnowledgeEntity.update({
        where: { id: params.entityId },
        data: { currentDraftVersionId: version.id },
      });

      return version;
    });
  }

  async requireVersion(id: string) {
    const row = await this.findById(id);
    if (!row) throw new KnowledgeVersionNotFoundError(id);
    return row;
  }
}

let repo: KnowledgeVersionRepository | null = null;

export function getKnowledgeVersionRepository(): KnowledgeVersionRepository {
  if (!repo) repo = new KnowledgeVersionRepository();
  return repo;
}

export function resetKnowledgeVersionRepositoryForTests(): void {
  repo = null;
}
