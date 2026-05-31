import type { CaseConfidence } from '../../ai-doctor/ai-doctor.types.js';
import type { GroundedDifferential } from '../../ai-doctor/ai-doctor.types.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval.types.js';
import { computePrecisionAt4 } from './golden-set.eval.js';
import { computeRecallAt10 } from './golden-set-live.eval.js';
import {
  GSE_DIMENSION_WEIGHTS,
  normalizeGoldenRecord,
  type GseCompositeScores,
  type GseEvalResult,
  type GseEvalSummary,
  type GoldenEvalRecord,
  type DimensionScore,
} from './golden-set.types.js';
import { scoreCitation } from './scorers/citation.scorer.js';
import { scoreConfidence } from './scorers/confidence.scorer.js';
import { scoreGrounding } from './scorers/grounding.scorer.js';
import { scoreRetrieval } from './scorers/retrieval.scorer.js';
import { scoreSafety } from './scorers/safety.scorer.js';
import { scoreVeterinary } from './scorers/veterinary.scorer.js';

export type GseEvaluateParams = {
  query: GoldenEvalRecord;
  pack: KnowledgeContextPack;
  differentials?: GroundedDifferential[];
  caseConfidence?: CaseConfidence;
  assistantOutput?: string;
  disclaimerPresent?: boolean;
  escalationRecommended?: boolean;
  humanRedirect?: boolean;
  refused?: boolean;
  corpusUnavailable?: boolean;
};

function applyCorpusUnavailableRelaxation(
  dimensions: DimensionScore[],
  corpusUnavailable?: boolean,
): DimensionScore[] {
  if (!corpusUnavailable) return dimensions;
  return dimensions.map((dim) => {
    if (dim.dimension !== 'citation' && dim.dimension !== 'grounding') return dim;
    const relaxedViolations = dim.violations.filter(
      (v) =>
        !v.startsWith('citation count') &&
        !v.startsWith('expected citation entity') &&
        !v.startsWith('citation coverage') &&
        !v.startsWith('expected inline citation block'),
    );
    return {
      ...dim,
      violations: relaxedViolations,
      passed: relaxedViolations.length === 0,
      score: relaxedViolations.length === 0 ? Math.max(dim.score, 70) : dim.score,
    };
  });
}

export function evaluateGseRecord(params: GseEvaluateParams): GseEvalResult {
  const query = normalizeGoldenRecord(params.query);
  const retrievedSlugs = params.pack.chunks.map((c) => c.slug);
  const actualRouting = params.pack.routingDecision.action;
  const expectedRouting =
    query.expectedEscalation?.routing ?? query.expectedRouting;

  const dimensions = [
    scoreRetrieval({
      query,
      retrievedSlugs,
      actualRouting,
      ...(params.corpusUnavailable !== undefined
        ? { corpusUnavailable: params.corpusUnavailable }
        : {}),
    }),
    scoreGrounding({ query, pack: params.pack }),
    scoreCitation({ query, pack: params.pack }),
    scoreSafety({
      query,
      pack: params.pack,
      retrievedSlugs,
      ...(params.assistantOutput !== undefined ? { assistantOutput: params.assistantOutput } : {}),
      ...(params.escalationRecommended !== undefined
        ? { escalationRecommended: params.escalationRecommended }
        : {}),
      ...(params.humanRedirect !== undefined ? { humanRedirect: params.humanRedirect } : {}),
      ...(params.refused !== undefined ? { refused: params.refused } : {}),
    }),
    scoreConfidence({
      query,
      pack: params.pack,
      ...(params.caseConfidence !== undefined ? { caseConfidence: params.caseConfidence } : {}),
    }),
    scoreVeterinary({
      query,
      pack: params.pack,
      ...(params.differentials !== undefined ? { differentials: params.differentials } : {}),
      ...(params.assistantOutput !== undefined ? { assistantOutput: params.assistantOutput } : {}),
      ...(params.disclaimerPresent !== undefined
        ? { disclaimerPresent: params.disclaimerPresent }
        : {}),
    }),
  ];

  const relaxedDimensions = applyCorpusUnavailableRelaxation(
    dimensions,
    params.corpusUnavailable,
  );

  const violations = relaxedDimensions.flatMap((d) => d.violations);
  const compositeScore = Math.round(
    relaxedDimensions.reduce((sum, d) => sum + d.score * GSE_DIMENSION_WEIGHTS[d.dimension], 0),
  );

  const routingMatch =
    relaxedDimensions.find((d) => d.dimension === 'retrieval')?.metrics.routingMatch === true ||
    relaxedDimensions.find((d) => d.dimension === 'safety')?.metrics.routingMatch === true;

  return {
    queryId: query.id,
    passed: violations.length === 0,
    compositeScore,
    dimensions: relaxedDimensions,
    violations,
    routingMatch: Boolean(routingMatch),
    actualRouting,
    expectedRouting: String(expectedRouting),
    precisionAt4: computePrecisionAt4({ retrievedSlugs, relevantSlugs: query.relevantSlugs }),
    recallAt10: computeRecallAt10({ retrievedSlugs, relevantSlugs: query.relevantSlugs }),
  };
}

export function summarizeGseEval(results: GseEvalResult[]): GseEvalSummary {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const dimensionAverages = {} as GseEvalSummary['dimensionAverages'];

  for (const dim of Object.keys(GSE_DIMENSION_WEIGHTS) as Array<
    keyof typeof GSE_DIMENSION_WEIGHTS
  >) {
    const dimScores = results.flatMap((r) =>
      r.dimensions.filter((d) => d.dimension === dim).map((d) => d.score),
    );
    dimensionAverages[dim] =
      dimScores.length > 0 ? dimScores.reduce((a, b) => a + b, 0) / dimScores.length : 0;
  }

  const blockExpected = results.filter((r) => r.expectedRouting === 'BLOCK');

  return {
    total,
    passed,
    passRate: total > 0 ? passed / total : 0,
    avgCompositeScore:
      total > 0 ? results.reduce((s, r) => s + r.compositeScore, 0) / total : 0,
    avgPrecisionAt4:
      total > 0 ? results.reduce((s, r) => s + r.precisionAt4, 0) / total : 0,
    avgRecallAt10:
      total > 0 ? results.reduce((s, r) => s + r.recallAt10, 0) / total : 0,
    dimensionAverages,
    routingAccuracy:
      total > 0 ? results.filter((r) => r.routingMatch).length / total : 0,
    blockCorrect: blockExpected.filter((r) => r.actualRouting === 'BLOCK').length,
    blockTotal: blockExpected.length,
  };
}

export function compositeScoresFromSummary(summary: GseEvalSummary): GseCompositeScores {
  const dims = summary.dimensionAverages;
  const productionReadinessScore = Math.round(
    dims.retrieval * 0.2 +
      dims.grounding * 0.15 +
      dims.citation * 0.15 +
      dims.safety * 0.2 +
      dims.confidence * 0.15 +
      dims.veterinary * 0.15,
  );

  return {
    retrievalScore: Math.round(dims.retrieval),
    groundingScore: Math.round(dims.grounding),
    citationScore: Math.round(dims.citation),
    safetyScore: Math.round(dims.safety),
    confidenceScore: Math.round(dims.confidence),
    veterinaryScore: Math.round(dims.veterinary),
    productionReadinessScore: Math.min(100, productionReadinessScore),
  };
}

export class GseEvaluatorService {
  readonly name = 'GseEvaluatorService';

  evaluate = evaluateGseRecord;
  summarize = summarizeGseEval;
  compositeScores = compositeScoresFromSummary;
}

let service: GseEvaluatorService | null = null;

export function getGseEvaluatorService(): GseEvaluatorService {
  if (!service) service = new GseEvaluatorService();
  return service;
}

export function resetGseEvaluatorForTests(): void {
  service = null;
}
