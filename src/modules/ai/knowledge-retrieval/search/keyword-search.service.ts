import {
  AiKnowledgeChunkStage,
  AiKnowledgeStatus,
  type LivestockSpecies,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';
import type { RetrievalLocale, RetrievalProfile } from '../knowledge-retrieval.types.js';
import { scoreLexicalMatch } from './lexical-scoring.util.js';

export type KeywordSearchHit = {
  knowledgeEntryId: string;
  chunkIndex: number;
  entryVersion: number;
  lexicalScore: number;
};

export class KeywordSearchService {
  readonly name = 'KeywordSearchService';

  async search(params: {
    query: string;
    profile: RetrievalProfile;
    species?: LivestockSpecies;
    locale?: RetrievalLocale;
    expandedTerms?: string[];
    limit?: number;
  }): Promise<KeywordSearchHit[]> {
    const q = params.query.trim();
    if (!q) return [];

    const limit = params.limit ?? 30;
    const searchTerms = [q, ...(params.expandedTerms ?? [])].filter(
      (term, index, arr) => term.trim().length > 0 && arr.indexOf(term) === index,
    );

    const orClauses = searchTerms.flatMap((term) => [
      { contentBn: { contains: term, mode: 'insensitive' as const } },
      { contentEn: { contains: term, mode: 'insensitive' as const } },
      {
        knowledgeEntry: {
          OR: [
            { searchText: { contains: term, mode: 'insensitive' as const } },
            { titleBn: { contains: term, mode: 'insensitive' as const } },
            { titleEn: { contains: term, mode: 'insensitive' as const } },
          ],
        },
      },
    ]);

    const chunks = await getPrisma().aiKnowledgeChunk.findMany({
      where: {
        stage: AiKnowledgeChunkStage.PUBLISHED,
        knowledgeEntry: {
          status: AiKnowledgeStatus.PUBLISHED,
          contentType: { in: params.profile.domainPriority as AiKnowledgeContentType[] },
          ...(params.species ? { species: { has: params.species } } : {}),
        },
        OR: orClauses,
      },
      include: {
        knowledgeEntry: { select: { version: true, searchText: true, titleBn: true, titleEn: true } },
      },
      take: limit * 2,
    });

    const scored: KeywordSearchHit[] = [];
    for (const chunk of chunks) {
      const entry = chunk.knowledgeEntry;
      const lexicalScore = scoreLexicalMatch({
        query: q,
        contentBn: chunk.contentBn,
        contentEn: chunk.contentEn,
        titleBn: entry.titleBn,
        titleEn: entry.titleEn,
        searchText: entry.searchText,
        ...(params.locale ? { locale: params.locale } : {}),
      });
      if (lexicalScore <= 0) continue;
      scored.push({
        knowledgeEntryId: chunk.knowledgeEntryId,
        chunkIndex: chunk.chunkIndex,
        entryVersion: entry.version,
        lexicalScore,
      });
    }

    scored.sort((a, b) => b.lexicalScore - a.lexicalScore);
    return scored.slice(0, limit);
  }
}

let service: KeywordSearchService | null = null;

export function getKeywordSearchService(): KeywordSearchService {
  if (!service) service = new KeywordSearchService();
  return service;
}

export function resetKeywordSearchServiceForTests(): void {
  service = null;
}
