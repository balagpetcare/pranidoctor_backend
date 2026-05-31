import { randomUUID } from 'node:crypto';



import {

  AiKnowledgeChunkStage,

  AiKnowledgeStatus,

  type AiKnowledgeEvidenceLevel,

} from '../../../generated/prisma/index.js';

import { getPrisma } from '../../../shared/database/prisma.js';

import { meetsRetrievalGate } from '../knowledge-ingestion/scoring/confidence.engine.js';

import type { AiDbTaskType } from '../routing/ai-task.types.js';

import type { KnowledgeContextPack, RetrievalRequest, RetrievedChunk, StructuredFact } from './knowledge-retrieval.types.js';

import { resolveCalibratedRetrievalProfile } from './calibration/medical-confidence.calibration.js';

import { normalizeQueryForRetrieval } from './query/query-normalizer.service.js';

import { getCrossEncoderRerankerService } from './ranking/cross-encoder-reranker.service.js';

import { buildRetrievalMetadataJson } from './telemetry/retrieval-metadata.builder.js';

import {

  buildKnowledgeContextPack,

  decideConfidenceRouting,

  extractStructuredFacts,

  isHighClinicalRisk,

  passesEvidenceFloor,

} from './routing/confidence-router.service.js';

import {

  buildSourceCitations,

  extractInlineCitation,

} from './packs/citation-builder.js';

import { getHybridFusionService } from './search/hybrid-fusion.service.js';

import { domainPriorityBoost } from './profiles/retrieval-profile.registry.js';

import { getGraphExpansionService } from './graph/graph-expansion.service.js';
import { detectEmergencyQuery } from './graph/graph-expansion.logic.js';
import { injectGraphRescueCandidates } from './graph/graph-rescue.service.js';

import { getKeywordSearchService } from './search/keyword-search.service.js';

import { getSemanticSearchService } from './search/semantic-search.service.js';

import { getRerankerService } from './ranking/reranker.service.js';

import { assessMedicalRiskTier } from './grounding/medical-safety.service.js';



export class KnowledgeRetrievalService {

  readonly name = 'KnowledgeRetrievalService';



  async retrieve(request: RetrievalRequest): Promise<KnowledgeContextPack> {

    const started = Date.now();

    const profile = resolveCalibratedRetrievalProfile({

      taskType: request.taskType,

      ...(request.profileId ? { profileId: request.profileId } : {}),

    });

    const normalized = normalizeQueryForRetrieval({

      query: request.query,

      locale: request.locale,

    });

    const normalizedQuery = normalized.text;



    const lexicalStart = Date.now();

    const lexicalHits = await getKeywordSearchService().search({

      query: normalizedQuery,

      profile,

      locale: request.locale,

      expandedTerms: normalized.expandedTerms,

      ...(request.species ? { species: request.species } : {}),

    });

    const lexicalMs = Date.now() - lexicalStart;



    const semanticStart = Date.now();

    const semanticResult = await getSemanticSearchService().search({

      query: normalizedQuery,

      profile,

      ...(request.species ? { species: request.species } : {}),

    });

    const semanticMs = Date.now() - semanticStart;



    const graphExpansion = await getGraphExpansionService().expand({

      query: normalizedQuery,

      expandedTerms: normalized.expandedTerms,

      emergencyProfile:

        profile.profileId === 'emergency-v1' || detectEmergencyQuery(normalizedQuery),

    });



    const fusionStart = Date.now();

    const searchEntryIds = [

      ...new Set([

        ...lexicalHits.map((h) => h.knowledgeEntryId),

        ...semanticResult.hits.map((h) => h.knowledgeEntryId),

      ]),

    ];

    const searchEntries =

      searchEntryIds.length > 0

        ? await getPrisma().aiKnowledgeEntry.findMany({

            where: { id: { in: searchEntryIds }, status: AiKnowledgeStatus.PUBLISHED },

            select: { id: true, contentType: true, slug: true },

          })

        : [];

    const searchContentTypeByEntry = new Map(searchEntries.map((e) => [e.id, e.contentType]));

    const searchSlugByEntryId = new Map(searchEntries.map((e) => [e.id, e.slug]));

    let fused = getHybridFusionService().fuse({

      lexical: lexicalHits,

      semantic: semanticResult.hits,

      profile,

      contentTypeByEntry: searchContentTypeByEntry,

      slugByEntryId: searchSlugByEntryId,

      slugBoosts: graphExpansion.slugBoosts,

    });

    fused = await injectGraphRescueCandidates({

      diseaseSlugs: graphExpansion.diseaseSlugs,

      slugBoosts: graphExpansion.slugBoosts,

      profile,

      fused,

      ...(request.species ? { species: request.species } : {}),

    });

    const entryIds = [...new Set(fused.map((c) => c.knowledgeEntryId))];



    const entries =

      entryIds.length > 0

        ? await getPrisma().aiKnowledgeEntry.findMany({

            where: { id: { in: entryIds }, status: AiKnowledgeStatus.PUBLISHED },

            include: { source: true },

          })

        : [];



    const contentTypeByEntry = new Map(entries.map((e) => [e.id, e.contentType]));

    const slugByEntryId = new Map(entries.map((e) => [e.id, e.slug]));

    const confidenceByEntry = new Map(

      entries.map((e) => [

        e.id,

        e.confidenceScore ?? e.provisionalConfidenceScore ?? 0,

      ]),

    );



    const fusedForRerank = fused.map((candidate) => {

      const contentType = contentTypeByEntry.get(candidate.knowledgeEntryId) ?? 'FARM_MGMT';

      const domainBoost = domainPriorityBoost(contentType, profile.domainPriority);

      return { ...candidate, domainBoost };

    });

    const fusionMs = Date.now() - fusionStart;



    const candidateKeys = fused.map((c) => ({

      knowledgeEntryId: c.knowledgeEntryId,

      chunkIndex: c.chunkIndex,

    }));



    const chunkPreview =

      candidateKeys.length > 0

        ? await getPrisma().aiKnowledgeChunk.findMany({

            where: {

              stage: AiKnowledgeChunkStage.PUBLISHED,

              OR: candidateKeys.map((k) => ({

                knowledgeEntryId: k.knowledgeEntryId,

                chunkIndex: k.chunkIndex,

              })),

            },

            select: {

              knowledgeEntryId: true,

              chunkIndex: true,

              contentBn: true,

              contentEn: true,

            },

          })

        : [];



    const chunkTextByKey = new Map(

      chunkPreview.map((c) => [

        `${c.knowledgeEntryId}:${c.chunkIndex}`,

        { contentBn: c.contentBn, contentEn: c.contentEn },

      ]),

    );



    const rerankStart = Date.now();

    const featureRanked = getRerankerService().rerank({

      fused: fusedForRerank,

      profile,

      confidenceByEntry,

      contentTypeByEntry,

      chunkTextByKey,

      locale: request.locale,

      slugByEntryId,

      slugBoosts: graphExpansion.slugBoosts,

    });

    const rerankMs = Date.now() - rerankStart;



    const crossEncoderResult = await getCrossEncoderRerankerService().rerank({

      query: normalizedQuery,

      candidates: featureRanked,

      profile,

      contentTypeByEntry,

      chunkTextByKey,

      locale: request.locale,

    });

    const reranked = crossEncoderResult.candidates;



    const rankStart = Date.now();

    let excludedCount = 0;

    const selectedKeys: Array<{ knowledgeEntryId: string; chunkIndex: number }> = [];

    const perEntityCount = new Map<string, number>();

    const slugToEntry = new Map(entries.map((e) => [e.slug, e]));

    const missingGraphSlugs = graphExpansion.diseaseSlugs.filter((slug) => !slugToEntry.has(slug));
    if (missingGraphSlugs.length > 0) {
      const graphEntries = await getPrisma().aiKnowledgeEntry.findMany({
        where: {
          slug: { in: missingGraphSlugs },
          status: AiKnowledgeStatus.PUBLISHED,
        },
        include: { source: true },
      });
      for (const graphEntry of graphEntries) {
        if (!entries.some((e) => e.id === graphEntry.id)) {
          entries.push(graphEntry);
        }
        slugToEntry.set(graphEntry.slug, graphEntry);
        contentTypeByEntry.set(graphEntry.id, graphEntry.contentType);
        confidenceByEntry.set(
          graphEntry.id,
          graphEntry.confidenceScore ?? graphEntry.provisionalConfidenceScore ?? 0,
        );
        slugByEntryId.set(graphEntry.id, graphEntry.slug);
      }
    }

    const trySelectCandidate = (candidate: (typeof reranked)[number]): boolean => {
      const entry = entries.find((e) => e.id === candidate.knowledgeEntryId);
      if (!entry) {
        excludedCount += 1;
        return false;
      }

      const evidenceLevel = (entry.evidenceLevel ??
        entry.provisionalEvidenceLevel ??
        'L2') as AiKnowledgeEvidenceLevel;
      const confidenceScore = entry.confidenceScore ?? entry.provisionalConfidenceScore ?? 0;

      if (
        !meetsRetrievalGate({
          confidence: confidenceScore,
          evidenceLevel,
          minConfidence: profile.minConfidence,
          minEvidence: profile.minEvidenceLevel,
        })
      ) {
        excludedCount += 1;
        return false;
      }

      if (!passesEvidenceFloor(evidenceLevel, profile.minEvidenceLevel)) {
        excludedCount += 1;
        return false;
      }

      if (profile.vetApprovedRequired && isHighClinicalRisk(entry.clinicalRiskTier) && !entry.approvedByVetId) {
        excludedCount += 1;
        return false;
      }

      const entityChunks = perEntityCount.get(entry.id) ?? 0;
      if (entityChunks >= profile.maxChunksPerEntity) {
        excludedCount += 1;
        return false;
      }

      selectedKeys.push({
        knowledgeEntryId: candidate.knowledgeEntryId,
        chunkIndex: candidate.chunkIndex,
      });
      perEntityCount.set(entry.id, entityChunks + 1);
      return true;
    };

    const maxGraphPins = Math.min(4, graphExpansion.diseaseSlugs.length, profile.maxChunks);
    for (const slug of graphExpansion.diseaseSlugs.slice(0, maxGraphPins)) {
      if (selectedKeys.length >= profile.maxChunks) break;
      const entry = slugToEntry.get(slug);
      if (!entry) continue;
      let candidate = reranked.find((c) => c.knowledgeEntryId === entry.id);
      if (!candidate) {
        const fallbackChunk = await getPrisma().aiKnowledgeChunk.findFirst({
          where: {
            stage: AiKnowledgeChunkStage.PUBLISHED,
            knowledgeEntryId: entry.id,
          },
          orderBy: { chunkIndex: 'asc' },
          select: { chunkIndex: true },
        });
        if (!fallbackChunk) continue;
        candidate = {
          knowledgeEntryId: entry.id,
          chunkIndex: fallbackChunk.chunkIndex,
          entryVersion: entry.version,
          lexicalScore: 0.9,
          semanticScore: 0.8,
          fusedScore: 1,
          domainBoost: 1,
          finalRankScore: 1,
          confidenceBoost: 1,
          localeBoost: 1,
        };
      }
      trySelectCandidate(candidate);
    }



    for (const candidate of reranked) {
      if (selectedKeys.length >= profile.maxChunks) break;
      const alreadySelected = selectedKeys.some(
        (k) =>
          k.knowledgeEntryId === candidate.knowledgeEntryId &&
          k.chunkIndex === candidate.chunkIndex,
      );
      if (alreadySelected) continue;
      trySelectCandidate(candidate);
    }



    const chunkRows =

      selectedKeys.length > 0

        ? await getPrisma().aiKnowledgeChunk.findMany({

            where: {

              stage: AiKnowledgeChunkStage.PUBLISHED,

              OR: selectedKeys.map((k) => ({

                knowledgeEntryId: k.knowledgeEntryId,

                chunkIndex: k.chunkIndex,

              })),

            },

          })

        : [];



    const embeddingCount =

      selectedKeys.length > 0

        ? await getPrisma().aiKnowledgeEmbeddingChunk.count({

            where: {

              active: true,

              OR: selectedKeys.map((k) => ({

                knowledgeEntryId: k.knowledgeEntryId,

                chunkIndex: k.chunkIndex,

              })),

            },

          })

        : 0;



    const embeddingCoverage =

      selectedKeys.length > 0 ? embeddingCount / selectedKeys.length : semanticResult.queryEmbedded ? 0 : 1;



    const retrievalMode =

      semanticResult.hits.length > 0 && lexicalHits.length > 0

        ? 'hybrid'

        : semanticResult.hits.length > 0

          ? 'semantic'

          : 'lexical';



    const retrievedChunks: RetrievedChunk[] = [];

    const structuredFacts: StructuredFact[] = [];



    for (let rank = 0; rank < selectedKeys.length; rank += 1) {

      const key = selectedKeys[rank];

      if (!key) continue;

      const entry = entries.find((e) => e.id === key.knowledgeEntryId);

      const chunk = chunkRows.find(

        (c) => c.knowledgeEntryId === key.knowledgeEntryId && c.chunkIndex === key.chunkIndex,

      );

      const fusedCandidate = reranked.find(

        (f) => f.knowledgeEntryId === key.knowledgeEntryId && f.chunkIndex === key.chunkIndex,

      );

      if (!entry || !chunk || !fusedCandidate) continue;



      const primaryText = request.locale === 'bn' ? chunk.contentBn : chunk.contentEn;

      const parallelText = request.locale === 'bn' ? chunk.contentEn : chunk.contentBn;

      if (!primaryText.trim() && !parallelText.trim()) continue;



      const evidenceLevel = (entry.evidenceLevel ??

        entry.provisionalEvidenceLevel ??

        'L2') as AiKnowledgeEvidenceLevel;

      const confidenceScore = entry.confidenceScore ?? entry.provisionalConfidenceScore ?? 0;

      const inlineCitation = extractInlineCitation(

        chunk.citationJson,

        entry.source?.sourceKey ?? entry.slug,

      );

      const title = request.locale === 'bn' ? entry.titleBn : entry.titleEn;

      const excerpt = (primaryText || parallelText).slice(0, 280);

      const sources = buildSourceCitations({

        sourceId: entry.sourceId,

        sourceKey: entry.source?.sourceKey ?? null,

        slug: entry.slug,

        titleBn: entry.titleBn,

        titleEn: entry.titleEn,

        locale: request.locale,

      });



      retrievedChunks.push({

        knowledgeEntryId: entry.id,

        chunkIndex: chunk.chunkIndex,

        entryVersion: entry.version,

        contentType: entry.contentType,

        slug: entry.slug,

        title,

        excerpt,

        ...(request.locale === 'bn'

          ? { excerptEn: chunk.contentEn.slice(0, 280) }

          : { excerptEn: chunk.contentBn.slice(0, 280) }),

        ...(chunk.headingPath ? { headingPath: chunk.headingPath } : {}),

        evidenceLevel,

        confidenceScore,

        clinicalRiskTier: entry.clinicalRiskTier,

        rank: rank + 1,

        fusedScore: fusedCandidate.finalRankScore,

        lexicalScore: fusedCandidate.lexicalScore,

        semanticScore: fusedCandidate.semanticScore,

        inlineCitation,

        sources,

      });



      structuredFacts.push(

        ...extractStructuredFacts({

          knowledgeEntryId: entry.id,

          contentType: entry.contentType,

          metadataJson: entry.metadataJson,

          evidenceLevel,

          confidenceScore,

          inlineCitation,

        }),

      );

    }



    const rankMs = Date.now() - rankStart;



    const medicalRiskTier = assessMedicalRiskTier({

      query: request.query,

      taskType: request.taskType,

      chunks: retrievedChunks,

    });



    const routingDecision = decideConfidenceRouting({

      profile,

      query: request.query,

      chunks: retrievedChunks,

      structuredFacts,

      embeddingCoverage,

      semanticEnabled: profile.semanticEnabled,

    });



    const packBuildStart = Date.now();

    const pack = buildKnowledgeContextPack({

      packId: randomUUID(),

      taskType: request.taskType as AiDbTaskType,

      locale: request.locale,

      query: request.query,

      normalizedQuery,

      profile,

      retrievalMode,

      chunks: retrievedChunks,

      structuredFacts,

      excludedCount,

      embeddingCoverage,

      routingDecision,

      medicalRiskTier,

      graphHints: graphExpansion.hints,

      scores: {

        lexicalMs,

        semanticMs,

        fusionMs,

        rerankMs,

        crossEncoderMs: crossEncoderResult.crossEncoderMs,

        rankMs,

        packBuildMs: Date.now() - packBuildStart,

        totalMs: Date.now() - started,

      },

    });



    pack.retrievalMetadata = buildRetrievalMetadataJson({

      pack,

      normalized,

      profileLexicalWeight: profile.lexicalWeight,

      profileSemanticWeight: profile.semanticWeight,

      crossEncoderApplied: crossEncoderResult.crossEncoderApplied,

      ...(crossEncoderResult.rerankSkipped

        ? { rerankSkipped: crossEncoderResult.rerankSkipped }

        : {}),

      searchBackend: semanticResult.searchBackend,

      crossEncoderMs: crossEncoderResult.crossEncoderMs,

    });



    return pack;

  }

}



let service: KnowledgeRetrievalService | null = null;



export function getKnowledgeRetrievalService(): KnowledgeRetrievalService {

  if (!service) service = new KnowledgeRetrievalService();

  return service;

}



export function resetKnowledgeRetrievalServiceForTests(): void {

  service = null;

}


