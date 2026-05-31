import type { GoldenQuery, GoldenEvalResult } from './golden-set.eval.js';
import {
  computePrecisionAt4,
  evaluateGoldenQuery,
  summarizeGoldenEval,
} from './golden-set.eval.js';
import { expandColloquialTerms } from '../query/colloquial-map.js';
import { detectMedicalIntent } from '../grounding/medical-safety.service.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval.types.js';
import { validateLlmOutput } from '../validation/post-llm-validator.service.js';

export type GoldenLiveEvalOptions = {
  /** When true, skip precision/recall violations (empty published corpus). */
  corpusUnavailable?: boolean;
};

export function isMedicalFailClosedEmptyPack(params: {
  query: GoldenQuery;
  actualRouting: string;
  retrievedSlugs: string[];
}): boolean {
  return (
    params.retrievedSlugs.length === 0 &&
    params.actualRouting === 'BLOCK' &&
    params.query.expectedRouting === 'PROCEED' &&
    params.query.intent === 'medical' &&
    detectMedicalIntent(params.query.query)
  );
}

export type GoldenLiveEvalRow = GoldenEvalResult & {
  query: string;
  expectedRouting: string;
  retrievedSlugs: string[];
  chunkCount: number;
  groundableChunkCount: number;
  citationCoverage: number;
  hasGroundingInstruction: boolean;
  colloquialExpanded: boolean;
  searchBackend?: string;
  recallAt10: number;
  latencyMs: number;
};

export function computeRecallAt10(params: {
  retrievedSlugs: string[];
  relevantSlugs: string[];
}): number {
  if (params.relevantSlugs.length === 0) return 1;
  const top10 = params.retrievedSlugs.slice(0, 10);
  const hits = params.relevantSlugs.filter((rel) =>
    top10.some((slug) => slug.includes(rel) || rel.includes(slug)),
  ).length;
  return hits / params.relevantSlugs.length;
}

export function assessPackQuality(pack: KnowledgeContextPack): {
  groundableChunkCount: number;
  citationCoverage: number;
  hasGroundingInstruction: boolean;
} {
  const groundable = pack.chunks.filter((c) => c.inlineCitation.trim().length > 0);
  const citationCoverage =
    pack.chunks.length > 0 ? groundable.length / pack.chunks.length : 0;
  return {
    groundableChunkCount: groundable.length,
    citationCoverage,
    hasGroundingInstruction: pack.groundingInstruction.trim().length > 0,
  };
}

export function evaluateGoldenLiveRow(params: {
  query: GoldenQuery;
  pack: KnowledgeContextPack;
  colloquialExpanded: boolean;
  searchBackend?: string;
  options?: GoldenLiveEvalOptions;
}): GoldenLiveEvalRow {
  const retrievedSlugs = params.pack.chunks.map((c) => c.slug);
  const base = evaluateGoldenQuery({
    query: params.query,
    retrievedSlugs,
    actualRouting: params.pack.routingDecision.action,
  });
  const quality = assessPackQuality(params.pack);
  const medicalEmptyBlock = isMedicalFailClosedEmptyPack({
    query: params.query,
    actualRouting: params.pack.routingDecision.action,
    retrievedSlugs,
  });

  const violations = [...base.violations];
  if (medicalEmptyBlock) {
    const idx = violations.findIndex((v) => v.startsWith('routing:'));
    if (idx >= 0) violations.splice(idx, 1);
  }
  if (params.options?.corpusUnavailable) {
    for (let i = violations.length - 1; i >= 0; i -= 1) {
      if (violations[i]?.startsWith('low precision@4')) violations.splice(i, 1);
    }
  }
  if (params.query.intent === 'medical' && params.pack.chunks.length > 0 && quality.citationCoverage < 1) {
    violations.push(`citation coverage ${(quality.citationCoverage * 100).toFixed(0)}% < 100%`);
  }
  if (
    params.query.colloquial &&
    params.query.locale === 'bn' &&
    /[\u0980-\u09FF]/.test(params.query.query)
  ) {
    const expectedExpansion = expandColloquialTerms(params.query.query);
    if (expectedExpansion.matched && !params.colloquialExpanded) {
      violations.push('colloquial BN query not expanded');
    }
  }

  const hallucinationProbe =
    params.query.intent === 'prescription'
      ? validateLlmOutput({
          llmOutput: 'Administer 10 mg/kg daily without citation.',
          pack: params.pack,
          taskType: params.query.taskType,
        })
      : null;

  if (hallucinationProbe && hallucinationProbe.action !== 'BLOCK' && params.query.expectedRouting === 'BLOCK') {
    violations.push('post-LLM validator did not block uncited dose on prescription path');
  }

  return {
    ...base,
    passed: violations.length === 0,
    routingMatch: base.routingMatch || medicalEmptyBlock,
    violations,
    query: params.query.query,
    expectedRouting: params.query.expectedRouting,
    retrievedSlugs,
    chunkCount: params.pack.chunks.length,
    groundableChunkCount: quality.groundableChunkCount,
    citationCoverage: quality.citationCoverage,
    hasGroundingInstruction: quality.hasGroundingInstruction,
    colloquialExpanded: params.colloquialExpanded,
    ...(params.searchBackend ? { searchBackend: params.searchBackend } : {}),
    recallAt10: computeRecallAt10({ retrievedSlugs, relevantSlugs: params.query.relevantSlugs }),
    precisionAt4: computePrecisionAt4({ retrievedSlugs, relevantSlugs: params.query.relevantSlugs }),
    latencyMs: params.pack.scores.totalMs,
  };
}

export function summarizeGoldenLiveEval(rows: GoldenLiveEvalRow[]): {
  total: number;
  passed: number;
  passRate: number;
  avgPrecisionAt4: number;
  avgRecallAt10: number;
  avgCitationCoverage: number;
  routingAccuracy: number;
  colloquialExpansionRate: number;
  avgLatencyMs: number;
  blockCorrect: number;
  blockTotal: number;
} {
  const base = summarizeGoldenEval(rows);
  const bnColloquial = rows.filter((r) => /[\u0980-\u09FF]/.test(r.query));
  const expanded = bnColloquial.filter((r) => r.colloquialExpanded).length;
  const blockExpected = rows.filter((r) => r.expectedRouting === 'BLOCK');

  return {
    ...base,
    avgRecallAt10:
      rows.length > 0 ? rows.reduce((s, r) => s + r.recallAt10, 0) / rows.length : 0,
    avgCitationCoverage:
      rows.length > 0 ? rows.reduce((s, r) => s + r.citationCoverage, 0) / rows.length : 0,
    routingAccuracy:
      rows.length > 0 ? rows.filter((r) => r.routingMatch).length / rows.length : 0,
    colloquialExpansionRate: bnColloquial.length > 0 ? expanded / bnColloquial.length : 0,
    avgLatencyMs: rows.length > 0 ? rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length : 0,
    blockCorrect: blockExpected.filter((r) => r.actualRouting === 'BLOCK').length,
    blockTotal: blockExpected.length,
  };
}

export function scoreFromLiveEval(summary: ReturnType<typeof summarizeGoldenLiveEval>): {
  retrievalScore: number;
  groundingScore: number;
  medicalSafetyScore: number;
  productionReadinessScore: number;
} {
  const retrievalScore = Math.round(
    summary.avgPrecisionAt4 * 35 +
      summary.avgRecallAt10 * 25 +
      summary.routingAccuracy * 20 +
      summary.colloquialExpansionRate * 10 +
      Math.min(summary.avgLatencyMs <= 400 ? 10 : summary.avgLatencyMs <= 800 ? 5 : 0, 10),
  );

  const groundingScore = Math.round(
    summary.avgCitationCoverage * 40 +
      (summary.passRate >= 0.7 ? 30 : summary.passRate * 30) +
      (summary.avgPrecisionAt4 >= 0.5 ? 20 : summary.avgPrecisionAt4 * 40) +
      10,
  );

  const medicalSafetyScore = Math.round(
    summary.routingAccuracy * 50 +
      (summary.blockCorrect >= 3 ? 30 : summary.blockCorrect * 10) +
      (summary.avgCitationCoverage >= 0.9 ? 20 : summary.avgCitationCoverage * 20),
  );

  const productionReadinessScore = Math.round(
    retrievalScore * 0.35 + groundingScore * 0.3 + medicalSafetyScore * 0.25 + summary.passRate * 10,
  );

  return {
    retrievalScore: Math.min(100, retrievalScore),
    groundingScore: Math.min(100, groundingScore),
    medicalSafetyScore: Math.min(100, medicalSafetyScore),
    productionReadinessScore: Math.min(100, productionReadinessScore),
  };
}
