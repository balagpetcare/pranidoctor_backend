import {
  AiKnowledgeChunkStage,
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { NotFoundError } from '../../../../shared/errors/http.errors.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { buildChunksForEntry } from '../chunking/chunk-pipeline.service.js';
import { hasRequiredSourceAttribution } from '../citation/attribution.util.js';
import { buildSourceAttribution, citationJsonFromAttribution, renderInlineRagCitation } from '../citation/citation.service.js';
import { KnowledgeEntryWorkflowError } from '../knowledge-ingestion.errors.js';
import type { PublishKnowledgeInput } from '../knowledge-ingestion.types.js';
import { computeConfidenceScore } from '../scoring/confidence.engine.js';

export class KnowledgePublishWorkflowService {
  readonly name = 'KnowledgePublishWorkflowService';

  async publish(input: PublishKnowledgeInput) {
    const entry = await getPrisma().aiKnowledgeEntry.findUnique({
      where: { id: input.knowledgeEntryId },
      include: { source: true },
    });
    if (!entry) throw new NotFoundError('KNOWLEDGE_ENTRY_NOT_FOUND', 'Knowledge entry not found');

    if (entry.status !== AiKnowledgeStatus.DRAFT) {
      throw new KnowledgeEntryWorkflowError(
        'INVALID_STATUS',
        `Publish requires DRAFT status after review; current status is ${entry.status}`,
      );
    }

    const needsVet =
      entry.clinicalRiskTier === 'HIGH' ||
      entry.clinicalRiskTier === 'CRITICAL' ||
      entry.contentType === 'MEDICINE' ||
      entry.contentType === 'EMERGENCY';

    if (needsVet && !entry.approvedByVetId) {
      throw new KnowledgeEntryWorkflowError(
        'VET_APPROVAL_REQUIRED',
        'Veterinary approval required before publish',
      );
    }

    if (entry.sourceId && !hasRequiredSourceAttribution(entry.metadataJson)) {
      throw new KnowledgeEntryWorkflowError(
        'ATTRIBUTION_REQUIRED',
        'Ingested knowledge must include at least one source attribution before publish',
      );
    }

    const evidenceLevel = entry.evidenceLevel ?? entry.provisionalEvidenceLevel ?? 'L2';
    const confidenceScore =
      entry.confidenceScore ??
      computeConfidenceScore({
        evidenceLevel,
        trustTier: entry.source?.trustTier ?? 2,
        reviewCompletenessScore: entry.reviewedById ? 1 : 0.5,
        graphConnectivityScore: 0.3,
        lastReviewedAt: new Date(),
        provisional: false,
      });

    await getPrisma().aiKnowledgeChunk.deleteMany({
      where: { knowledgeEntryId: entry.id, stage: AiKnowledgeChunkStage.PUBLISHED },
    });

    let stagingChunks = await getPrisma().aiKnowledgeChunk.findMany({
      where: { knowledgeEntryId: entry.id, stage: AiKnowledgeChunkStage.STAGING },
      orderBy: { chunkIndex: 'asc' },
    });

    if (stagingChunks.length === 0) {
      stagingChunks = await this.materializeStagingChunks(entry);
    }

    if (stagingChunks.length > 0) {
      await getPrisma().aiKnowledgeChunk.createMany({
        data: stagingChunks.map((chunk) => ({
          knowledgeEntryId: entry.id,
          chunkIndex: chunk.chunkIndex,
          chunkPolicyId: chunk.chunkPolicyId,
          stage: AiKnowledgeChunkStage.PUBLISHED,
          contentBn: chunk.contentBn,
          contentEn: chunk.contentEn,
          tokenEstimate: chunk.tokenEstimate,
          headingPath: chunk.headingPath,
          ...(chunk.citationJson != null ? { citationJson: toInputJson(chunk.citationJson) } : {}),
          ...(chunk.metadataJson != null ? { metadataJson: toInputJson(chunk.metadataJson) } : {}),
        })),
      });
    }

    const published = await getPrisma().aiKnowledgeEntry.update({
      where: { id: entry.id },
      data: omitUndefined({
        status: AiKnowledgeStatus.PUBLISHED,
        publishedAt: new Date(),
        reviewedById: input.reviewedById ?? entry.reviewedById ?? input.actorUserId,
        evidenceLevel,
        confidenceScore,
        embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING,
      }),
    });

    const { getKnowledgeEmbeddingService } = await import(
      '../../knowledge-retrieval/embedding/knowledge-embedding.service.js'
    );
    getKnowledgeEmbeddingService().scheduleEmbedEntry(published.id);

    return published;
  }

  private async materializeStagingChunks(entry: {
    id: string;
    titleBn: string;
    titleEn: string;
    bodyBn: string;
    bodyEn: string;
    contentType: import('../../../../generated/prisma/index.js').AiKnowledgeContentType;
    chunkPolicyId: string | null;
    sourceId: string | null;
    source: { sourceKey: string; id: string } | null;
    metadataJson: unknown;
  }) {
    const chunks = buildChunksForEntry({
      titleBn: entry.titleBn,
      titleEn: entry.titleEn,
      bodyBn: entry.bodyBn,
      bodyEn: entry.bodyEn,
      contentType: entry.contentType,
      ...(entry.chunkPolicyId ? { chunkPolicyId: entry.chunkPolicyId } : {}),
    });

    if (chunks.length === 0) return [];

    const inline = renderInlineRagCitation(entry.source?.sourceKey ?? entry.id);
    const attribution = buildSourceAttribution({
      sourceId: entry.sourceId ?? entry.id,
    });
    const citationJson = citationJsonFromAttribution(attribution, inline);

    await getPrisma().aiKnowledgeChunk.deleteMany({
      where: { knowledgeEntryId: entry.id, stage: AiKnowledgeChunkStage.STAGING },
    });

    await getPrisma().aiKnowledgeChunk.createMany({
      data: chunks.map((chunk) => ({
        knowledgeEntryId: entry.id,
        chunkIndex: chunk.chunkIndex,
        chunkPolicyId: chunk.chunkPolicyId,
        stage: AiKnowledgeChunkStage.STAGING,
        contentBn: chunk.contentBn,
        contentEn: chunk.contentEn,
        tokenEstimate: chunk.tokenEstimate,
        headingPath: chunk.headingPath ?? null,
        citationJson: toInputJson(citationJson),
      })),
    });

    return getPrisma().aiKnowledgeChunk.findMany({
      where: { knowledgeEntryId: entry.id, stage: AiKnowledgeChunkStage.STAGING },
      orderBy: { chunkIndex: 'asc' },
    });
  }
}

let publishService: KnowledgePublishWorkflowService | null = null;

export function getKnowledgePublishWorkflowService(): KnowledgePublishWorkflowService {
  if (!publishService) publishService = new KnowledgePublishWorkflowService();
  return publishService;
}

export function resetKnowledgePublishWorkflowForTests(): void {
  publishService = null;
}
