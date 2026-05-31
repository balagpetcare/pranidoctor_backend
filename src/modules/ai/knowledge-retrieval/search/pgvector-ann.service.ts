import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';
import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { resolveVreConfig } from '../config/vre-config.js';
import type { RetrievalProfile } from '../knowledge-retrieval.types.js';
import { formatPgvectorLiteral, isPgvectorColumnAvailable } from './pgvector.util.js';
import type { SemanticSearchHit } from './semantic-search.service.js';

export type PgvectorAnnRow = {
  knowledgeEntryId: string;
  chunkIndex: number;
  entryVersion: number;
  semanticScore: number;
};

export async function searchPgvectorAnn(params: {
  queryVector: number[];
  modelKey: string;
  profile: RetrievalProfile;
  species?: LivestockSpecies;
  limit: number;
  minSemanticSimilarity: number;
}): Promise<PgvectorAnnRow[]> {
  const config = resolveVreConfig();
  if (!config.pgvectorAnnEnabled) return [];
  if (!(await isPgvectorColumnAvailable())) return [];

  const domains = params.profile.domainPriority as AiKnowledgeContentType[];
  const literal = formatPgvectorLiteral(params.queryVector);
  const limit = params.limit;

  const rows = params.species
    ? await getPrisma().$queryRawUnsafe<
        Array<{
          knowledgeEntryId: string;
          chunkIndex: number;
          entryVersion: number;
          semantic_score: number;
        }>
      >(
        `SELECT
           e."knowledgeEntryId" AS "knowledgeEntryId",
           e."chunkIndex" AS "chunkIndex",
           e."entryVersion" AS "entryVersion",
           (1 - (e."embeddingVector" <=> $1::vector))::float8 AS semantic_score
         FROM "AiKnowledgeEmbeddingChunk" e
         INNER JOIN "AiKnowledgeEntry" ke ON ke."id" = e."knowledgeEntryId"
         WHERE e."active" = true
           AND e."embeddingVector" IS NOT NULL
           AND e."modelKey" = $2
           AND e."dimensions" = $3
           AND ke."status" = 'PUBLISHED'
           AND ke."contentType" = ANY($4::"AiKnowledgeContentType"[])
           AND $5::"LivestockSpecies" = ANY(ke."species")
           AND e."entryVersion" = ke."version"
           AND (1 - (e."embeddingVector" <=> $1::vector)) >= $6
         ORDER BY e."embeddingVector" <=> $1::vector
         LIMIT $7`,
        literal,
        params.modelKey,
        params.queryVector.length,
        domains,
        params.species,
        params.minSemanticSimilarity,
        limit,
      )
    : await getPrisma().$queryRawUnsafe<
        Array<{
          knowledgeEntryId: string;
          chunkIndex: number;
          entryVersion: number;
          semantic_score: number;
        }>
      >(
        `SELECT
           e."knowledgeEntryId" AS "knowledgeEntryId",
           e."chunkIndex" AS "chunkIndex",
           e."entryVersion" AS "entryVersion",
           (1 - (e."embeddingVector" <=> $1::vector))::float8 AS semantic_score
         FROM "AiKnowledgeEmbeddingChunk" e
         INNER JOIN "AiKnowledgeEntry" ke ON ke."id" = e."knowledgeEntryId"
         WHERE e."active" = true
           AND e."embeddingVector" IS NOT NULL
           AND e."modelKey" = $2
           AND e."dimensions" = $3
           AND ke."status" = 'PUBLISHED'
           AND ke."contentType" = ANY($4::"AiKnowledgeContentType"[])
           AND e."entryVersion" = ke."version"
           AND (1 - (e."embeddingVector" <=> $1::vector)) >= $5
         ORDER BY e."embeddingVector" <=> $1::vector
         LIMIT $6`,
        literal,
        params.modelKey,
        params.queryVector.length,
        domains,
        params.minSemanticSimilarity,
        limit,
      );

  return rows.map((row) => ({
    knowledgeEntryId: row.knowledgeEntryId,
    chunkIndex: row.chunkIndex,
    entryVersion: row.entryVersion,
    semanticScore: Number(row.semantic_score),
  }));
}

export function mapAnnRowsToHits(rows: PgvectorAnnRow[]): SemanticSearchHit[] {
  return rows.map((row) => ({
    knowledgeEntryId: row.knowledgeEntryId,
    chunkIndex: row.chunkIndex,
    entryVersion: row.entryVersion,
    semanticScore: row.semanticScore,
  }));
}
