import {
  AiKnowledgeChunkStage,
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeStatus,
  type AiKnowledgeContentType,
  type AiKnowledgeEvidenceLevel,
  type VkKnowledgeDomain,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { toInputJson } from '../../../shared/database/prisma-json.js';
import { getKnowledgeEmbeddingPipelineService } from '../knowledge-retrieval/embedding/embedding-pipeline.service.js';
import { buildSearchText } from './knowledge-foundation.types.js';

const DOMAIN_TO_CONTENT_TYPE: Record<VkKnowledgeDomain, AiKnowledgeContentType> = {
  DISEASE: 'DISEASE',
  MEDICINE: 'MEDICINE',
  VACCINE: 'VACCINE',
  FEED: 'FEED',
  EMERGENCY: 'EMERGENCY',
  CLINICAL_PROTOCOL: 'FARM_MGMT',
  BREED: 'FARM_MGMT',
  REPRODUCTION: 'FARM_MGMT',
  REGULATORY_BD: 'MEDICINE',
  FARM_MGMT: 'FARM_MGMT',
};

type ChunkMetadataEnvelope = {
  citationCache?: {
    primaryInlineToken?: string;
    humanCitationBn?: string;
    humanCitationEn?: string;
    sourceKeys?: string[];
  };
};

function inlineFromMetadata(metadataJson: unknown, fallbackKey: string): string {
  if (metadataJson && typeof metadataJson === 'object') {
    const token = (metadataJson as ChunkMetadataEnvelope).citationCache?.primaryInlineToken;
    if (token?.trim()) return token.trim();
  }
  return `[${fallbackKey}]`;
}

export class VkLegacyRagSyncService {
  readonly name = 'VkLegacyRagSyncService';

  async syncPublishedVersion(versionId: string): Promise<{ legacyEntryId: string; chunkCount: number }> {
    const version = await getPrisma().vkKnowledgeVersion.findUnique({
      where: { id: versionId },
      include: {
        entity: true,
        citations: { include: { source: true }, take: 1 },
        evidenceRecords: { orderBy: { assessedAt: 'desc' }, take: 1 },
        confidenceRecords: { orderBy: { computedAt: 'desc' }, take: 1 },
      },
    });

    if (!version || version.status !== 'PUBLISHED') {
      throw new Error(`Version ${versionId} is not published`);
    }

    const entity = version.entity;
    const vkChunks = await getPrisma().vkKnowledgeChunk.findMany({
      where: { versionId, stage: AiKnowledgeChunkStage.PUBLISHED },
      orderBy: { chunkIndex: 'asc' },
    });

    const primaryCitation = version.citations[0];
    const sourceId = primaryCitation?.sourceId ?? null;
    const sourceKey = primaryCitation?.source?.sourceKey ?? entity.slug;
    const evidenceLevel = (version.evidenceRecords[0]?.evidenceLevel ?? 'L2') as AiKnowledgeEvidenceLevel;
    const confidenceScore = version.confidenceRecords[0]?.score ?? 0.65;
    const contentType = DOMAIN_TO_CONTENT_TYPE[entity.domain] ?? 'FARM_MGMT';

    const searchText = buildSearchText({
      titleBn: version.titleBn,
      titleEn: version.titleEn,
      bodyBn: version.bodyBn,
      bodyEn: version.bodyEn,
      keywordsBn: version.keywordsBn,
      keywordsEn: version.keywordsEn,
      colloquialBn: version.colloquialBn,
    });

    let legacyEntryId = entity.legacyEntryId;

    if (legacyEntryId) {
      await getPrisma().aiKnowledgeEntry.update({
        where: { id: legacyEntryId },
        data: {
          contentType,
          titleBn: version.titleBn,
          titleEn: version.titleEn,
          bodyBn: version.bodyBn,
          bodyEn: version.bodyEn,
          species: version.species,
          status: AiKnowledgeStatus.PUBLISHED,
          version: version.versionNumber,
          publishedAt: version.publishedAt ?? new Date(),
          searchText,
          sourceId,
          importRunId: version.importRunId,
          chunkPolicyId: version.chunkPolicyId,
          evidenceLevel,
          confidenceScore,
          clinicalRiskTier: version.clinicalRiskTier,
          embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING,
          metadataJson: toInputJson({
            vkEntityId: entity.id,
            vkVersionId: version.id,
            domain: entity.domain,
            entityType: entity.entityType,
          }),
        },
      });

      await getPrisma().aiKnowledgeChunk.deleteMany({
        where: { knowledgeEntryId: legacyEntryId },
      });
    } else {
      const entry = await getPrisma().aiKnowledgeEntry.create({
        data: {
          contentType,
          slug: entity.slug,
          audience: version.audience,
          titleBn: version.titleBn,
          titleEn: version.titleEn,
          bodyBn: version.bodyBn,
          bodyEn: version.bodyEn,
          species: version.species,
          status: AiKnowledgeStatus.PUBLISHED,
          version: version.versionNumber,
          publishedAt: version.publishedAt ?? new Date(),
          searchText,
          sourceId,
          importRunId: version.importRunId,
          chunkPolicyId: version.chunkPolicyId,
          evidenceLevel,
          confidenceScore,
          clinicalRiskTier: version.clinicalRiskTier,
          embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING,
          approvedByVetId:
            version.clinicalRiskTier === 'HIGH' || version.clinicalRiskTier === 'CRITICAL'
              ? 'wave1-vet-reviewer'
              : null,
          metadataJson: toInputJson({
            vkEntityId: entity.id,
            vkVersionId: version.id,
            domain: entity.domain,
            entityType: entity.entityType,
          }),
        },
      });
      legacyEntryId = entry.id;

      await getPrisma().vkKnowledgeEntity.update({
        where: { id: entity.id },
        data: { legacyEntryId },
      });
    }

    if (vkChunks.length > 0) {
      await getPrisma().aiKnowledgeChunk.createMany({
        data: vkChunks.map((chunk) => {
          const row = {
            knowledgeEntryId: legacyEntryId!,
            chunkIndex: chunk.chunkIndex,
            chunkPolicyId: chunk.chunkPolicyId,
            stage: AiKnowledgeChunkStage.PUBLISHED,
            contentBn: chunk.contentBn,
            contentEn: chunk.contentEn,
            tokenEstimate: chunk.tokenEstimate,
            headingPath: chunk.headingPath,
            citationJson: toInputJson({
              inline: inlineFromMetadata(chunk.metadataJson, sourceKey),
              sourceKey,
              humanCitationBn:
                (chunk.metadataJson as ChunkMetadataEnvelope)?.citationCache?.humanCitationBn ?? null,
              humanCitationEn:
                (chunk.metadataJson as ChunkMetadataEnvelope)?.citationCache?.humanCitationEn ?? null,
            }),
            ...(chunk.metadataJson != null
              ? { metadataJson: toInputJson(chunk.metadataJson) }
              : {}),
          };
          return row;
        }),
      });
    }

    getKnowledgeEmbeddingPipelineService().scheduleEmbedEntry(legacyEntryId);

    return { legacyEntryId, chunkCount: vkChunks.length };
  }

  async syncAllPublished(): Promise<{ entries: number; chunks: number }> {
    const published = await getPrisma().vkKnowledgeVersion.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true },
      orderBy: { publishedAt: 'asc' },
    });

    let entries = 0;
    let chunks = 0;
    for (const row of published) {
      const result = await this.syncPublishedVersion(row.id);
      entries += 1;
      chunks += result.chunkCount;
    }
    return { entries, chunks };
  }

  async embedAllLegacyEntries(): Promise<{ indexed: number; failed: number }> {
    const entries = await getPrisma().aiKnowledgeEntry.findMany({
      where: { status: AiKnowledgeStatus.PUBLISHED },
      select: { id: true },
    });

    let indexed = 0;
    let failed = 0;
    const pipeline = getKnowledgeEmbeddingPipelineService();

    for (const entry of entries) {
      const result = await pipeline.embedEntry(entry.id);
      indexed += result.indexed;
      failed += result.failed;
    }

    return { indexed, failed };
  }
}

let service: VkLegacyRagSyncService | null = null;

export function getVkLegacyRagSyncService(): VkLegacyRagSyncService {
  if (!service) service = new VkLegacyRagSyncService();
  return service;
}

export function resetVkLegacyRagSyncServiceForTests(): void {
  service = null;
}
