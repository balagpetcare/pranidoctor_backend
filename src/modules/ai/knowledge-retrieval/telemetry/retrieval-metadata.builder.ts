import { createHash } from 'node:crypto';

import type {
  ConfidenceRoutingAction,
  KnowledgeContextPack,
  RetrievalMode,
} from '../knowledge-retrieval.types.js';
import type { NormalizedQuery } from '../query/query-normalizer.service.js';

export type RetrievalMetadataJson = {
  schemaVersion: '1.0';
  packId: string;
  retrievalProfileId: string;
  retrievalMode: RetrievalMode;
  queryHash: string;
  queryLocale: 'bn' | 'en';
  queryExpanded: boolean;
  domainsRetrieved: string[];
  chunkCount: number;
  groundableChunkCount: number;
  excludedCount: number;
  confidenceSummary: { min: number; max: number; avg: number };
  evidenceSummary: { min: string; max: string; dominant: string };
  routingDecision: ConfidenceRoutingAction;
  routingReason: string;
  medicalRiskTier: string;
  embeddingCoverage: number;
  degraded: boolean;
  failClosed: boolean;
  semanticEnabled: boolean;
  rerankerEnabled: boolean;
  crossEncoderApplied: boolean;
  rerankSkipped?: string;
  searchBackend?: 'pgvector_ann' | 'full_scan';
  pgvectorAnn: boolean;
  fusionWeights: { lexical: number; semantic: number };
  latencyMs: KnowledgeContextPack['scores'] & { crossEncoderMs?: number };
  topSlugs: string[];
  topSourceKeys: string[];
  topChunkKeys: string[];
};

export function hashRetrievalQuery(query: string): string {
  return createHash('sha256').update(query.trim()).digest('hex');
}

export function buildRetrievalMetadataJson(params: {
  pack: KnowledgeContextPack;
  normalized: NormalizedQuery;
  profileLexicalWeight: number;
  profileSemanticWeight: number;
  crossEncoderApplied: boolean;
  rerankSkipped?: string;
  searchBackend?: 'pgvector_ann' | 'full_scan';
  crossEncoderMs?: number;
}): RetrievalMetadataJson {
  const { pack } = params;
  const groundableChunkCount = pack.chunks.filter((c) => c.inlineCitation.trim().length > 0).length;

  return {
    schemaVersion: '1.0',
    packId: pack.packId,
    retrievalProfileId: pack.retrievalProfileId,
    retrievalMode: pack.retrievalMode,
    queryHash: hashRetrievalQuery(params.normalized.original),
    queryLocale: params.normalized.locale,
    queryExpanded: params.normalized.colloquialExpanded,
    domainsRetrieved: [...new Set(pack.chunks.map((c) => c.contentType))],
    chunkCount: pack.chunks.length,
    groundableChunkCount,
    excludedCount: pack.excludedCount,
    confidenceSummary: pack.confidenceSummary,
    evidenceSummary: pack.evidenceSummary,
    routingDecision: pack.routingDecision.action,
    routingReason: pack.routingDecision.reason,
    medicalRiskTier: pack.routingDecision.medicalRiskTier,
    embeddingCoverage: pack.embeddingCoverage,
    degraded: pack.routingDecision.action === 'PROCEED_DEGRADED',
    failClosed: pack.routingDecision.failClosed,
    semanticEnabled: pack.retrievalMode !== 'lexical',
    rerankerEnabled:
      pack.retrievalProfileId.includes('prescription') ||
      pack.retrievalProfileId.includes('ai-doctor') ||
      pack.retrievalProfileId.includes('emergency'),
    crossEncoderApplied: params.crossEncoderApplied,
    ...(params.rerankSkipped ? { rerankSkipped: params.rerankSkipped } : {}),
    ...(params.searchBackend ? { searchBackend: params.searchBackend } : {}),
    pgvectorAnn: params.searchBackend === 'pgvector_ann',
    fusionWeights: {
      lexical: params.profileLexicalWeight,
      semantic: params.profileSemanticWeight,
    },
    latencyMs: {
      ...pack.scores,
      ...(params.crossEncoderMs !== undefined ? { crossEncoderMs: params.crossEncoderMs } : {}),
    },
    topSlugs: pack.chunks.slice(0, 6).map((c) => c.slug),
    topSourceKeys: pack.chunks
      .flatMap((c) => c.sources.map((s) => s.sourceKey).filter(Boolean) as string[])
      .slice(0, 6),
    topChunkKeys: pack.chunks.slice(0, 6).map((c) => `${c.knowledgeEntryId}:${c.chunkIndex}`),
  };
}
