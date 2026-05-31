import { AiKnowledgeStatus } from '../../../../generated/prisma/index.js';

import { getPrisma } from '../../../../shared/database/prisma.js';

import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';

import type { LivestockSpecies } from '../../../../generated/prisma/index.js';

import { resolveVreConfig } from '../config/vre-config.js';
import { getEmbeddingRouterAdapter } from '../embedding/embedding-router.adapter.js';
import { cosineSimilarity } from '../embedding/vector-math.util.js';

import type { RetrievalProfile } from '../knowledge-retrieval.types.js';

import { mapAnnRowsToHits, searchPgvectorAnn } from './pgvector-ann.service.js';



export type SemanticSearchHit = {

  knowledgeEntryId: string;

  chunkIndex: number;

  entryVersion: number;

  semanticScore: number;

};



export type SemanticSearchResult = {

  hits: SemanticSearchHit[];

  queryEmbedded: boolean;

  searchBackend: 'pgvector_ann' | 'full_scan';

};



export class SemanticSearchService {

  readonly name = 'SemanticSearchService';



  async search(params: {

    query: string;

    profile: RetrievalProfile;

    species?: LivestockSpecies;

    limit?: number;

  }): Promise<SemanticSearchResult> {

    if (!params.profile.semanticEnabled) {

      return { hits: [], queryEmbedded: false, searchBackend: 'full_scan' };

    }

    if (resolveVreConfig().evalLexicalOnly) {

      return { hits: [], queryEmbedded: false, searchBackend: 'full_scan' };

    }



    const embed = await getEmbeddingRouterAdapter().embedTexts(

      [params.query.trim()],

      'knowledge_retrieval_query',

    );

    if (!embed?.embeddings[0]?.length) {

      return { hits: [], queryEmbedded: false, searchBackend: 'full_scan' };

    }



    const queryVector = embed.embeddings[0]!;

    const limit = params.limit ?? 40;



    const annRows = await searchPgvectorAnn({

      queryVector,

      modelKey: embed.model,

      profile: params.profile,

      ...(params.species ? { species: params.species } : {}),

      limit,

      minSemanticSimilarity: params.profile.minSemanticSimilarity,

    });



    if (annRows.length > 0) {

      return {

        hits: mapAnnRowsToHits(annRows),

        queryEmbedded: true,

        searchBackend: 'pgvector_ann',

      };

    }



    const hits = await this.fullCorpusScan({

      queryVector,

      modelKey: embed.model,

      profile: params.profile,

      ...(params.species ? { species: params.species } : {}),

      limit,

    });



    return { hits, queryEmbedded: true, searchBackend: 'full_scan' };

  }



  /** Full-corpus cosine scan — no row cap (6C.13 removes 2000 limit). */

  private async fullCorpusScan(params: {

    queryVector: number[];

    modelKey: string;

    profile: RetrievalProfile;

    species?: LivestockSpecies;

    limit: number;

  }): Promise<SemanticSearchHit[]> {

    const rows = await getPrisma().aiKnowledgeEmbeddingChunk.findMany({

      where: {

        active: true,

        modelKey: params.modelKey,

        dimensions: params.queryVector.length,

        knowledgeEntry: {

          status: AiKnowledgeStatus.PUBLISHED,

          contentType: { in: params.profile.domainPriority as AiKnowledgeContentType[] },

          ...(params.species ? { species: { has: params.species } } : {}),

        },

      },

      select: {

        knowledgeEntryId: true,

        chunkIndex: true,

        entryVersion: true,

        vectorJson: true,

        knowledgeEntry: { select: { version: true } },

      },

    });



    const hits: SemanticSearchHit[] = [];

    for (const row of rows) {

      if (row.entryVersion !== row.knowledgeEntry.version) continue;

      const raw = row.vectorJson;

      if (!Array.isArray(raw)) continue;

      const vector = raw.filter((v): v is number => typeof v === 'number');

      if (vector.length !== params.queryVector.length) continue;

      const semanticScore = cosineSimilarity(params.queryVector, vector);

      if (semanticScore < params.profile.minSemanticSimilarity) continue;

      hits.push({

        knowledgeEntryId: row.knowledgeEntryId,

        chunkIndex: row.chunkIndex,

        entryVersion: row.entryVersion,

        semanticScore,

      });

    }



    hits.sort((a, b) => b.semanticScore - a.semanticScore);

    return hits.slice(0, params.limit);

  }

}



let service: SemanticSearchService | null = null;



export function getSemanticSearchService(): SemanticSearchService {

  if (!service) service = new SemanticSearchService();

  return service;

}



export function resetSemanticSearchServiceForTests(): void {

  service = null;

}


