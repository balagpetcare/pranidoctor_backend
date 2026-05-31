import type {
  ConfidenceRoutingDecision,
  KnowledgeContextPack,
  RetrievalProfile,
  RetrievedChunk,
  StructuredFact,
} from '../knowledge-retrieval.types.js';
import { buildCitationBlock } from './citation-builder.js';
import { buildConfidenceBlock, buildConfidenceSummary } from './confidence-builder.js';
import { buildEvidenceBlock, buildEvidenceSummary } from './evidence-builder.js';
import { buildGroundingInstruction } from '../grounding/grounding-engine.js';

/** Exclude chunks that cannot be cited in LLM grounding. */
export function filterGroundableChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.filter((chunk) => chunk.inlineCitation.trim().length > 0);
}

export function buildKnowledgeContextPack(params: {
  packId: string;
  taskType: KnowledgeContextPack['taskType'];
  locale: KnowledgeContextPack['locale'];
  query: string;
  normalizedQuery: string;
  profile: RetrievalProfile;
  retrievalMode: KnowledgeContextPack['retrievalMode'];
  chunks: RetrievedChunk[];
  structuredFacts: StructuredFact[];
  excludedCount: number;
  embeddingCoverage: number;
  routingDecision: ConfidenceRoutingDecision;
  scores: KnowledgeContextPack['scores'];
  medicalRiskTier?: KnowledgeContextPack['routingDecision']['medicalRiskTier'];
  graphHints?: KnowledgeContextPack['graphHints'];
}): KnowledgeContextPack {
  const groundableChunks = filterGroundableChunks(params.chunks);
  const groundableFactIds = new Set(
    groundableChunks.map((c) => c.knowledgeEntryId),
  );
  const structuredFacts = params.structuredFacts.filter((f) =>
    groundableFactIds.has(f.factId.split(':')[0] ?? ''),
  );

  const confidenceSummary = buildConfidenceSummary(groundableChunks);
  const evidenceSummary = buildEvidenceSummary(groundableChunks);

  const entityMap = new Map<
    string,
    {
      entityId: string;
      slug: string;
      contentType: RetrievedChunk['contentType'];
      title: string;
      evidenceLevel: RetrievedChunk['evidenceLevel'];
      confidenceScore: number;
      rank: number;
      chunkCount: number;
      sources: RetrievedChunk['sources'];
    }
  >();

  for (const chunk of groundableChunks) {
    const existing = entityMap.get(chunk.knowledgeEntryId);
    if (existing) {
      existing.chunkCount += 1;
      existing.rank = Math.min(existing.rank, chunk.rank);
    } else {
      entityMap.set(chunk.knowledgeEntryId, {
        entityId: chunk.knowledgeEntryId,
        slug: chunk.slug,
        contentType: chunk.contentType,
        title: chunk.title,
        evidenceLevel: chunk.evidenceLevel,
        confidenceScore: chunk.confidenceScore,
        rank: chunk.rank,
        chunkCount: 1,
        sources: chunk.sources,
      });
    }
  }

  const citationBlock = buildCitationBlock(groundableChunks, params.locale);
  const evidenceBlock = buildEvidenceBlock(groundableChunks, params.locale);
  const confidenceBlock = buildConfidenceBlock(
    groundableChunks,
    params.locale,
    confidenceSummary,
  );

  const structuredFactsJson =
    structuredFacts.length > 0
      ? JSON.stringify(structuredFacts, null, 2)
      : '';

  const groundingInstruction = buildGroundingInstruction({
    locale: params.locale,
    citationBlock,
    evidenceBlock,
    confidenceBlock,
    structuredFactsJson,
    strictness: params.profile.groundingStrictness,
    taskType: params.taskType,
  });

  return {
    packId: params.packId,
    taskType: params.taskType,
    locale: params.locale,
    query: params.query,
    normalizedQuery: params.normalizedQuery,
    retrievedAt: new Date().toISOString(),
    retrievalProfileId: params.profile.profileId,
    retrievalMode: params.retrievalMode,
    chunks: groundableChunks,
    entities: [...entityMap.values()].sort((a, b) => a.rank - b.rank),
    structuredFacts,
    citationBlock,
    evidenceBlock,
    confidenceBlock,
    groundingInstruction,
    graphHints: params.graphHints ?? [],
    filtersApplied: {
      domainPriority: params.profile.domainPriority,
      minConfidence: params.profile.minConfidence,
      minEvidenceLevel: params.profile.minEvidenceLevel,
      regionScope: 'BD',
      status: 'PUBLISHED',
      ...(params.profile.vetApprovedRequired ? { vetApprovedRequired: true } : {}),
    },
    confidenceSummary,
    evidenceSummary: evidenceSummary ?? { min: 'L1', max: 'L1', dominant: 'L1' },
    excludedCount: params.excludedCount,
    embeddingCoverage: params.embeddingCoverage,
    routingDecision: {
      ...params.routingDecision,
      medicalRiskTier: params.medicalRiskTier ?? params.routingDecision.medicalRiskTier,
    },
    scores: params.scores,
  };
}
