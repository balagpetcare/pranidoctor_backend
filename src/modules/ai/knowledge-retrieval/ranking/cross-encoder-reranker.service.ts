import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';
import type { RetrievalLocale, RetrievalProfile } from '../knowledge-retrieval.types.js';
import type { RankedCandidate } from './reranker.service.js';
import { resolveVreConfig } from '../config/vre-config.js';

export type CrossEncoderRerankResult = {
  candidates: RankedCandidate[];
  crossEncoderApplied: boolean;
  rerankSkipped?: string;
  crossEncoderMs: number;
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 1),
  );
}

function tokenOverlapScore(query: string, passage: string): number {
  const qTokens = tokenize(query);
  const pTokens = tokenize(passage);
  if (qTokens.size === 0 || pTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of qTokens) {
    if (pTokens.has(token)) overlap += 1;
  }
  return overlap / qTokens.size;
}

/** Lightweight cross-encoder surrogate — token overlap + fused score (no external API). */
export function scoreCrossEncoderPair(params: {
  query: string;
  passage: string;
  domain: AiKnowledgeContentType;
  fusedScore: number;
}): number {
  const overlap = tokenOverlapScore(params.query, params.passage);
  const domainBoost =
    params.domain === 'MEDICINE' || params.domain === 'EMERGENCY' ? 0.05 : 0;
  return Math.min(1, params.fusedScore * 0.55 + overlap * 0.4 + domainBoost);
}

export async function applyCrossEncoderRerank(params: {
  query: string;
  candidates: RankedCandidate[];
  profile: RetrievalProfile;
  contentTypeByEntry: Map<string, AiKnowledgeContentType>;
  chunkTextByKey: Map<string, { contentBn: string; contentEn: string }>;
  locale?: RetrievalLocale;
}): Promise<CrossEncoderRerankResult> {
  const started = Date.now();
  const config = resolveVreConfig();

  if (!config.crossEncoderRerankEnabled || !params.profile.rerankerEnabled) {
    return {
      candidates: params.candidates,
      crossEncoderApplied: false,
      rerankSkipped: 'disabled',
      crossEncoderMs: 0,
    };
  }

  const maxPairs = Math.min(config.crossEncoderMaxPairs, params.candidates.length);
  const top = params.candidates.slice(0, maxPairs);
  const tail = params.candidates.slice(maxPairs);

  const scored = top.map((candidate) => {
    const key = `${candidate.knowledgeEntryId}:${candidate.chunkIndex}`;
    const text = params.chunkTextByKey.get(key);
    const passage =
      params.locale === 'bn'
        ? text?.contentBn ?? text?.contentEn ?? ''
        : text?.contentEn ?? text?.contentBn ?? '';
    const domain =
      params.contentTypeByEntry.get(candidate.knowledgeEntryId) ?? 'FARM_MGMT';
    const crossScore = scoreCrossEncoderPair({
      query: params.query,
      passage,
      domain,
      fusedScore: candidate.finalRankScore,
    });
    return {
      ...candidate,
      finalRankScore: crossScore,
    };
  });

  scored.sort((a, b) => b.finalRankScore - a.finalRankScore);

  return {
    candidates: [...scored, ...tail],
    crossEncoderApplied: true,
    crossEncoderMs: Date.now() - started,
  };
}

export class CrossEncoderRerankerService {
  readonly name = 'CrossEncoderRerankerService';
  rerank = applyCrossEncoderRerank;
}

let service: CrossEncoderRerankerService | null = null;

export function getCrossEncoderRerankerService(): CrossEncoderRerankerService {
  if (!service) service = new CrossEncoderRerankerService();
  return service;
}

export function resetCrossEncoderRerankerForTests(): void {
  service = null;
}
