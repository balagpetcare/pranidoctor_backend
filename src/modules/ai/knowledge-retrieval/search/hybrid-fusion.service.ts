import type { SearchCandidate } from '../knowledge-retrieval.types.js';
import type { KeywordSearchHit } from './keyword-search.service.js';
import type { SemanticSearchHit } from './semantic-search.service.js';
import type { RetrievalProfile } from '../knowledge-retrieval.types.js';
import { domainPriorityBoost } from '../profiles/retrieval-profile.registry.js';

export type FusedCandidate = SearchCandidate & {
  fusedScore: number;
  domainBoost: number;
};

function candidateKey(id: string, index: number): string {
  return `${id}:${index}`;
}

export function fuseHybridCandidates(params: {
  lexical: KeywordSearchHit[];
  semantic: SemanticSearchHit[];
  profile: RetrievalProfile;
  contentTypeByEntry: Map<string, import('../../../../generated/prisma/index.js').AiKnowledgeContentType>;
  /** entryId → additive fusion boost from symptom graph (Phase 6E.2) */
  entryBoostById?: Map<string, number>;
  slugByEntryId?: Map<string, string>;
  slugBoosts?: Map<string, number>;
}): FusedCandidate[] {
  const map = new Map<string, FusedCandidate>();

  const lexicalMax = Math.max(...params.lexical.map((h) => h.lexicalScore), 0.001);
  const semanticMax = Math.max(...params.semantic.map((h) => h.semanticScore), 0.001);

  for (const hit of params.lexical) {
    const key = candidateKey(hit.knowledgeEntryId, hit.chunkIndex);
    const contentType = params.contentTypeByEntry.get(hit.knowledgeEntryId) ?? 'FARM_MGMT';
    const domainBoost = domainPriorityBoost(contentType, params.profile.domainPriority);
    map.set(key, {
      knowledgeEntryId: hit.knowledgeEntryId,
      chunkIndex: hit.chunkIndex,
      entryVersion: hit.entryVersion,
      lexicalScore: hit.lexicalScore / lexicalMax,
      semanticScore: 0,
      fusedScore: 0,
      domainBoost,
    });
  }

  for (const hit of params.semantic) {
    const key = candidateKey(hit.knowledgeEntryId, hit.chunkIndex);
    const contentType = params.contentTypeByEntry.get(hit.knowledgeEntryId) ?? 'FARM_MGMT';
    const domainBoost = domainPriorityBoost(contentType, params.profile.domainPriority);
    const normalizedSemantic = hit.semanticScore / semanticMax;
    const existing = map.get(key);
    if (existing) {
      existing.semanticScore = normalizedSemantic;
      existing.entryVersion = hit.entryVersion;
    } else {
      map.set(key, {
        knowledgeEntryId: hit.knowledgeEntryId,
        chunkIndex: hit.chunkIndex,
        entryVersion: hit.entryVersion,
        lexicalScore: 0,
        semanticScore: normalizedSemantic,
        fusedScore: 0,
        domainBoost,
      });
    }
  }

  const { lexicalWeight, semanticWeight } = params.profile;
  const totalWeight = lexicalWeight + semanticWeight || 1;

  for (const candidate of map.values()) {
    const base =
      (lexicalWeight / totalWeight) * candidate.lexicalScore +
      (semanticWeight / totalWeight) * candidate.semanticScore;
    let graphBoost = params.entryBoostById?.get(candidate.knowledgeEntryId) ?? 0;
    if (graphBoost === 0 && params.slugBoosts && params.slugByEntryId) {
      const slug = params.slugByEntryId.get(candidate.knowledgeEntryId);
      if (slug) graphBoost = params.slugBoosts.get(slug) ?? 0;
    }
    candidate.fusedScore = base * (1 + 0.2 * candidate.domainBoost + graphBoost);
  }

  return [...map.values()].sort((a, b) => b.fusedScore - a.fusedScore);
}

export class HybridFusionService {
  readonly name = 'HybridFusionService';

  fuse = fuseHybridCandidates;
}

let service: HybridFusionService | null = null;

export function getHybridFusionService(): HybridFusionService {
  if (!service) service = new HybridFusionService();
  return service;
}
