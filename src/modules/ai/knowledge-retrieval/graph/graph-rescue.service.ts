import {
  AiKnowledgeChunkStage,
  AiKnowledgeStatus,
  type LivestockSpecies,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { RetrievalProfile } from '../knowledge-retrieval.types.js';
import type { FusedCandidate } from '../search/hybrid-fusion.service.js';
import { domainPriorityBoost } from '../profiles/retrieval-profile.registry.js';
import { GRAPH_SLUG_BOOST } from './graph-expansion.logic.js';

function candidateKey(id: string, index: number): string {
  return `${id}:${index}`;
}

/** Inject top published chunk per graph-linked disease slug so symptom queries surface DDx entities. */
export async function injectGraphRescueCandidates(params: {
  diseaseSlugs: string[];
  slugBoosts: Map<string, number>;
  profile: RetrievalProfile;
  fused: FusedCandidate[];
  species?: LivestockSpecies;
}): Promise<FusedCandidate[]> {
  if (params.diseaseSlugs.length === 0) return params.fused;

  const entries = await getPrisma().aiKnowledgeEntry.findMany({
    where: {
      slug: { in: params.diseaseSlugs },
      status: AiKnowledgeStatus.PUBLISHED,
      ...(params.species ? { species: { has: params.species } } : {}),
    },
    select: { id: true, slug: true, version: true, contentType: true },
  });

  if (entries.length === 0) return params.fused;

  const chunks = await getPrisma().aiKnowledgeChunk.findMany({
    where: {
      stage: AiKnowledgeChunkStage.PUBLISHED,
      knowledgeEntryId: { in: entries.map((e) => e.id) },
    },
    orderBy: [{ knowledgeEntryId: 'asc' }, { chunkIndex: 'asc' }],
    select: { knowledgeEntryId: true, chunkIndex: true },
  });

  const firstChunkByEntry = new Map<string, number>();
  for (const chunk of chunks) {
    if (!firstChunkByEntry.has(chunk.knowledgeEntryId)) {
      firstChunkByEntry.set(chunk.knowledgeEntryId, chunk.chunkIndex);
    }
  }

  const maxFused = Math.max(...params.fused.map((c) => c.fusedScore), 0.35);
  const rescued: FusedCandidate[] = [];

  for (const entry of entries) {
    const chunkIndex = firstChunkByEntry.get(entry.id);
    if (chunkIndex === undefined) continue;

    const slugBoost = params.slugBoosts.get(entry.slug) ?? GRAPH_SLUG_BOOST;
    const domainBoost = domainPriorityBoost(entry.contentType, params.profile.domainPriority);

    rescued.push({
      knowledgeEntryId: entry.id,
      chunkIndex,
      entryVersion: entry.version,
      lexicalScore: 0.95,
      semanticScore: 0.85,
      fusedScore: maxFused + slugBoost + 0.25 * domainBoost,
      domainBoost,
    });
  }

  const merged = new Map<string, FusedCandidate>();
  for (const candidate of [...params.fused, ...rescued]) {
    const key = candidateKey(candidate.knowledgeEntryId, candidate.chunkIndex);
    const existing = merged.get(key);
    if (!existing || candidate.fusedScore > existing.fusedScore) {
      merged.set(key, candidate);
    }
  }

  return [...merged.values()].sort((a, b) => b.fusedScore - a.fusedScore);
}
