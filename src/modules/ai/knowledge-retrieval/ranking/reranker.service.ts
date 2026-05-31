import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';
import type { RetrievalLocale, RetrievalProfile } from '../knowledge-retrieval.types.js';
import type { FusedCandidate } from '../search/hybrid-fusion.service.js';
import { domainPriorityBoost } from '../profiles/retrieval-profile.registry.js';

export type RankedCandidate = FusedCandidate & {
  finalRankScore: number;
  confidenceBoost: number;
  localeBoost: number;
};

function localeAlignmentBoost(
  locale: RetrievalLocale | undefined,
  contentBn: string,
  contentEn: string,
): number {
  if (!locale) return 1;
  const bnRich = contentBn.trim().length;
  const enRich = contentEn.trim().length;
  if (locale === 'bn' && bnRich >= enRich) return 1.12;
  if (locale === 'en' && enRich >= bnRich) return 1.12;
  return 1;
}

export function rerankCandidates(params: {
  fused: FusedCandidate[];
  profile: RetrievalProfile;
  confidenceByEntry: Map<string, number>;
  contentTypeByEntry: Map<string, AiKnowledgeContentType>;
  chunkTextByKey: Map<string, { contentBn: string; contentEn: string }>;
  locale?: RetrievalLocale;
  limit?: number;
  slugByEntryId?: Map<string, string>;
  slugBoosts?: Map<string, number>;
}): RankedCandidate[] {
  const limit = params.limit ?? params.profile.maxChunks * 2;

  const ranked = params.fused.map((candidate) => {
    const confidence = params.confidenceByEntry.get(candidate.knowledgeEntryId) ?? 0.5;
    const contentType =
      params.contentTypeByEntry.get(candidate.knowledgeEntryId) ?? 'FARM_MGMT';
    const domainBoost = domainPriorityBoost(contentType, params.profile.domainPriority);
    const key = `${candidate.knowledgeEntryId}:${candidate.chunkIndex}`;
    const text = params.chunkTextByKey.get(key);
    const localeBoost = text
      ? localeAlignmentBoost(params.locale, text.contentBn, text.contentEn)
      : 1;
    const confidenceBoost = 0.5 + 0.5 * confidence;
    const slug = params.slugByEntryId?.get(candidate.knowledgeEntryId);
    const graphBoost = slug ? (params.slugBoosts?.get(slug) ?? 0) : 0;

    const finalRankScore =
      candidate.fusedScore *
      (1 + 0.2 * domainBoost + graphBoost * 1.5) *
      confidenceBoost *
      localeBoost *
      (params.profile.rerankerEnabled ? 1.05 : 1);

    return {
      ...candidate,
      domainBoost,
      finalRankScore,
      confidenceBoost,
      localeBoost,
    };
  });

  ranked.sort((a, b) => b.finalRankScore - a.finalRankScore);
  return ranked.slice(0, limit);
}

export class RerankerService {
  readonly name = 'RerankerService';

  rerank = rerankCandidates;
}

let service: RerankerService | null = null;

export function getRerankerService(): RerankerService {
  if (!service) service = new RerankerService();
  return service;
}

export function resetRerankerServiceForTests(): void {
  service = null;
}
