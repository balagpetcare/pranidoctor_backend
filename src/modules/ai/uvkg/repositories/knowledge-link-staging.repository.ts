import { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { UvkgLinkUpsertInput } from '../uvkg.types.js';
import { buildSourceLinkKey } from '../uvkg.util.js';

export class KnowledgeLinkStagingRepository {
  private prisma = getPrisma();

  async clearBatch(batchId: string): Promise<number> {
    const result = await this.prisma.vkKnowledgeLinkStaging.deleteMany({
      where: { rebuildBatchId: batchId },
    });
    return result.count;
  }

  async insertBatch(batchId: string, links: UvkgLinkUpsertInput[]): Promise<number> {
    if (links.length === 0) return 0;

    const data = links.map((input) => {
      const linkKey =
        input.sourceEdgeId != null
          ? buildSourceLinkKey(input.sourceSystem, input.sourceEdgeId)
          : buildSourceLinkKey(
              input.sourceSystem,
              `${input.edgeType}:${input.fromRefId}:${input.toRefId}`,
            );

      return {
        linkKey,
        edgeType: input.edgeType,
        edgeClass: input.edgeClass,
        fromEntityId: input.fromEntityId ?? null,
        fromRefType: input.fromRefType,
        fromRefId: input.fromRefId,
        toEntityId: input.toEntityId ?? null,
        toRefType: input.toRefType,
        toRefId: input.toRefId,
        direction: input.direction ?? ('DIRECTED' as const),
        weight: input.weight ?? 0.5,
        species: input.species ?? [],
        regionScope: input.regionScope ?? ['BD'],
        evidenceLevel: input.evidenceLevel ?? 'L2',
        confidenceScore: input.confidenceScore ?? 0.8,
        clinicalRiskTier: input.clinicalRiskTier ?? ('LOW' as const),
        status: input.status ?? ('DRAFT' as const),
        vkVersionId: input.vkVersionId ?? null,
        sourceEdgeId: input.sourceEdgeId ?? null,
        sourceSystem: input.sourceSystem,
        labelBn: input.labelBn ?? null,
        labelEn: input.labelEn ?? null,
        metadataJson: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        rebuildBatchId: batchId,
      };
    });

    const result = await this.prisma.vkKnowledgeLinkStaging.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  async countBatch(batchId: string): Promise<number> {
    return this.prisma.vkKnowledgeLinkStaging.count({ where: { rebuildBatchId: batchId } });
  }
}

let stagingRepository: KnowledgeLinkStagingRepository | undefined;

export function getKnowledgeLinkStagingRepository(): KnowledgeLinkStagingRepository {
  stagingRepository ??= new KnowledgeLinkStagingRepository();
  return stagingRepository;
}

export function resetKnowledgeLinkStagingRepositoryForTests(): void {
  stagingRepository = undefined;
}
