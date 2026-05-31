import { createHash } from 'node:crypto';

import {
  AiKnowledgeChunkStage,
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { buildEmbeddingText } from './embedding-text.util.js';
import { getEmbeddingRouterAdapter } from './embedding-router.adapter.js';
import { extractInlineCitation } from '../packs/citation-builder.js';
import { upsertEmbeddingVector } from '../search/pgvector.util.js';

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export class KnowledgeEmbeddingPipelineService {
  readonly name = 'KnowledgeEmbeddingPipelineService';

  async embedEntry(knowledgeEntryId: string): Promise<{ indexed: number; failed: number }> {
    const entry = await getPrisma().aiKnowledgeEntry.findUnique({
      where: { id: knowledgeEntryId },
      include: { source: true },
    });
    if (!entry || entry.status !== AiKnowledgeStatus.PUBLISHED) {
      return { indexed: 0, failed: 0 };
    }

    const chunks = await getPrisma().aiKnowledgeChunk.findMany({
      where: {
        knowledgeEntryId,
        stage: AiKnowledgeChunkStage.PUBLISHED,
      },
      orderBy: { chunkIndex: 'asc' },
    });

    if (chunks.length === 0) {
      await getPrisma().aiKnowledgeEntry.update({
        where: { id: knowledgeEntryId },
        data: { embeddingStatus: AiKnowledgeEmbeddingStatus.READY },
      });
      return { indexed: 0, failed: 0 };
    }

    const evidenceLevel = entry.evidenceLevel ?? entry.provisionalEvidenceLevel;
    const confidenceScore = entry.confidenceScore ?? entry.provisionalConfidenceScore;
    const sourceKey = entry.source?.sourceKey ?? entry.slug;

    const texts = chunks.map((chunk) =>
      buildEmbeddingText({
        contentType: entry.contentType,
        species: entry.species,
        clinicalRiskTier: entry.clinicalRiskTier,
        headingPath: chunk.headingPath,
        contentBn: chunk.contentBn,
        contentEn: chunk.contentEn,
        evidenceLevel,
        confidenceScore,
        inlineCitation: extractInlineCitation(chunk.citationJson, sourceKey),
      }),
    );

    const embedResult = await getEmbeddingRouterAdapter().embedTexts(texts, 'knowledge_embedding');
    if (!embedResult) {
      await getPrisma().aiKnowledgeEntry.update({
        where: { id: knowledgeEntryId },
        data: { embeddingStatus: AiKnowledgeEmbeddingStatus.FAILED },
      });
      return { indexed: 0, failed: chunks.length };
    }

    await getPrisma().aiKnowledgeEmbeddingChunk.updateMany({
      where: { knowledgeEntryId, active: true },
      data: { active: false },
    });

    let indexed = 0;
    let failed = 0;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const vector = embedResult.embeddings[i];
      const text = texts[i];
      if (!chunk || !vector?.length || !text) {
        failed += 1;
        continue;
      }

      const embeddingTextHash = sha256(text);
      const metadataSidecar = {
        contentType: entry.contentType,
        slug: entry.slug,
        species: entry.species,
        clinicalRiskTier: entry.clinicalRiskTier,
        evidenceLevel: evidenceLevel ?? 'L2',
        confidenceScore: confidenceScore ?? 0.5,
        vetApproved: Boolean(entry.approvedByVetId),
        primaryLocale: 'bn',
        sourceKeys: entry.source?.sourceKey ? [entry.source.sourceKey] : [entry.slug],
        inlineCitationPresent: Boolean(extractInlineCitation(chunk.citationJson, sourceKey).trim()),
      };

      const record = await getPrisma().aiKnowledgeEmbeddingChunk.upsert({
        where: {
          knowledgeEntryId_chunkIndex_entryVersion: {
            knowledgeEntryId,
            chunkIndex: chunk.chunkIndex,
            entryVersion: entry.version,
          },
        },
        create: {
          knowledgeEntryId,
          chunkIndex: chunk.chunkIndex,
          entryVersion: entry.version,
          providerKey: embedResult.provider,
          modelKey: embedResult.model,
          dimensions: embedResult.dimensions,
          vectorJson: toInputJson(vector),
          metadataSidecarJson: toInputJson(metadataSidecar),
          embeddingTextHash,
          active: true,
        },
        update: {
          providerKey: embedResult.provider,
          modelKey: embedResult.model,
          dimensions: embedResult.dimensions,
          vectorJson: toInputJson(vector),
          metadataSidecarJson: toInputJson(metadataSidecar),
          embeddingTextHash,
          active: true,
          embeddedAt: new Date(),
        },
      });

      await upsertEmbeddingVector({ id: record.id, vector });
      indexed += 1;
    }

    await getPrisma().aiKnowledgeEntry.update({
      where: { id: knowledgeEntryId },
      data: {
        embeddingStatus:
          failed > 0 && indexed === 0
            ? AiKnowledgeEmbeddingStatus.FAILED
            : AiKnowledgeEmbeddingStatus.READY,
      },
    });

    return { indexed, failed };
  }

  scheduleEmbedEntry(knowledgeEntryId: string): void {
    void this.embedEntry(knowledgeEntryId).catch(() => {
      void getPrisma().aiKnowledgeEntry.update({
        where: { id: knowledgeEntryId },
        data: { embeddingStatus: AiKnowledgeEmbeddingStatus.FAILED },
      });
    });
  }
}

let pipeline: KnowledgeEmbeddingPipelineService | null = null;

export function getKnowledgeEmbeddingPipelineService(): KnowledgeEmbeddingPipelineService {
  if (!pipeline) pipeline = new KnowledgeEmbeddingPipelineService();
  return pipeline;
}

export function resetKnowledgeEmbeddingPipelineForTests(): void {
  pipeline = null;
}
