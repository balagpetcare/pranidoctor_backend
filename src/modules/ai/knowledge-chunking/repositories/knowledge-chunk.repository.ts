import type { AiKnowledgeChunkStage } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type { ChunkMetadataEnvelopeV1, StagedChunkDraft } from '../knowledge-chunking.types.js';

export class KnowledgeChunkRepository {
  async deleteStagingForVersion(versionId: string) {
    return getPrisma().vkKnowledgeChunk.deleteMany({
      where: { versionId, stage: 'STAGING' },
    });
  }

  async createStagingBatch(
    versionId: string,
    chunks: Array<StagedChunkDraft & { metadataJson: ChunkMetadataEnvelopeV1 }>,
  ) {
    if (chunks.length === 0) return [];

    await this.deleteStagingForVersion(versionId);

    const created = [];
    for (const chunk of chunks) {
      const row = await getPrisma().vkKnowledgeChunk.create({
        data: {
          versionId,
          chunkIndex: chunk.chunkIndex,
          chunkPolicyId: chunk.chunkPolicyId,
          stage: 'STAGING',
          contentBn: chunk.contentBn,
          contentEn: chunk.contentEn,
          tokenEstimate: chunk.tokenEstimate,
          headingPath: chunk.headingPath ?? null,
          ...(chunk.structuredOverlay != null
            ? { structuredOverlay: toInputJson(chunk.structuredOverlay) }
            : {}),
          metadataJson: toInputJson(chunk.metadataJson),
        },
      });
      created.push(row);
    }
    return created;
  }

  async listByVersion(versionId: string, stage?: AiKnowledgeChunkStage) {
    return getPrisma().vkKnowledgeChunk.findMany({
      where: { versionId, ...(stage ? { stage } : {}) },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  async promoteStagingToPublished(versionId: string) {
    const staging = await this.listByVersion(versionId, 'STAGING');
    if (staging.length === 0) return [];

    await getPrisma().vkKnowledgeChunk.deleteMany({
      where: { versionId, stage: 'PUBLISHED' },
    });

    const published = [];
    for (const row of staging) {
      const copy = await getPrisma().vkKnowledgeChunk.create({
        data: {
          versionId,
          chunkIndex: row.chunkIndex,
          chunkPolicyId: row.chunkPolicyId,
          stage: 'PUBLISHED',
          contentBn: row.contentBn,
          contentEn: row.contentEn,
          tokenEstimate: row.tokenEstimate,
          headingPath: row.headingPath,
          ...(row.structuredOverlay != null ? { structuredOverlay: row.structuredOverlay } : {}),
          ...(row.metadataJson != null ? { metadataJson: row.metadataJson } : {}),
        },
      });
      published.push(copy);
    }
    return published;
  }
}

let repo: KnowledgeChunkRepository | null = null;

export function getKnowledgeChunkRepository(): KnowledgeChunkRepository {
  if (!repo) repo = new KnowledgeChunkRepository();
  return repo;
}

export function resetKnowledgeChunkRepositoryForTests(): void {
  repo = null;
}
