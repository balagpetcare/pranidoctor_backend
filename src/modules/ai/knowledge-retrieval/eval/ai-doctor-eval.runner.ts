import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import {
  AI_DOCTOR_FEATURE,
  AI_DOCTOR_RETRIEVAL_PROFILE,
  AI_DOCTOR_TASK_TYPE,
} from '../../ai-doctor/ai-doctor.constants.js';
import type { AnalyzeCaseResult } from '../../ai-doctor/ai-doctor.types.js';
import {
  allDifferentialsHaveCitations,
  fuseDifferentials,
  loadGraphDifferentials,
} from '../../ai-doctor/engines/differential-diagnosis.engine.js';
import {
  citationCoverage,
  computeCaseConfidence,
  shouldFailClosed,
  shouldRecommendEscalation,
} from '../../ai-doctor/engines/confidence.engine.js';
import {
  buildRetrievalQuery,
  buildSymptomSnapshot,
  computeSymptomCompleteness,
} from '../../ai-doctor/engines/symptom-intake.engine.js';
import { getKnowledgeRetrievalService } from '../knowledge-retrieval.service.js';
import { normalizeQueryForRetrieval } from '../query/query-normalizer.service.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval.types.js';
import { evaluateGseRecord, type GseEvaluateParams } from './gse-evaluator.service.js';
import type { GseEvalResult, GoldenEvalRecord } from './golden-set.types.js';

export type AiDoctorEvalRow = GseEvalResult & {
  query: string;
  profileId: string;
  species: LivestockSpecies;
  chunkCount: number;
  differentialCount: number;
  caseScore: number;
  confidenceTier: string;
  failClosed: boolean;
  escalationRecommended: boolean;
  humanRedirect: boolean;
  colloquialExpanded: boolean;
  latencyMs: number;
  assistantMode: 'retrieval-only' | 'differential' | 'full-analyze';
};

export type AiDoctorEvalOptions = {
  corpusUnavailable?: boolean;
  species?: LivestockSpecies;
  /** When set, use orchestrator analyze result instead of retrieval-only simulation. */
  analyzeResult?: AnalyzeCaseResult;
};

function defaultSpecies(record: GoldenEvalRecord): LivestockSpecies {
  const map: Record<string, LivestockSpecies> = {
    COW: 'COW',
    GOAT: 'GOAT',
    BUFFALO: 'BUFFALO',
    CHICKEN: 'CHICKEN',
    POULTRY: 'CHICKEN',
    DUCK: 'DUCK',
  };
  return map[record.species ?? 'COW'] ?? 'COW';
}

export async function runAiDoctorGoldenEval(params: {
  query: GoldenEvalRecord;
  options?: AiDoctorEvalOptions;
}): Promise<AiDoctorEvalRow> {
  const species = params.options?.species ?? defaultSpecies(params.query);
  const locale = params.query.locale;

  if (params.options?.analyzeResult) {
    return buildRowFromAnalyzeResult(params.query, params.options.analyzeResult, species);
  }

  const snapshot = buildSymptomSnapshot({
    symptomCodes: params.query.symptomCodes ?? [],
    freeTextSymptoms: [params.query.query],
    durationDays: params.query.durationDays ?? 2,
    severity: params.query.severity ?? 'MODERATE',
    locale,
  });
  const completeness = computeSymptomCompleteness(snapshot);
  const retrievalQuery = buildRetrievalQuery(snapshot, locale);
  const normalized = normalizeQueryForRetrieval({ query: params.query.query, locale });

  const graphRows = await loadGraphDifferentials({
    symptomCodes: snapshot.symptomCodes,
    species,
  });

  const pack = await getKnowledgeRetrievalService().retrieve({
    query: retrievalQuery,
    locale,
    taskType: AI_DOCTOR_TASK_TYPE,
    feature: AI_DOCTOR_FEATURE,
    profileId: AI_DOCTOR_RETRIEVAL_PROFILE,
    species,
  });

  const differentials = fuseDifferentials({ graphRows, pack, locale });
  const confidence = computeCaseConfidence({ pack, differentials, completeness });
  const hasCitations =
    differentials.length > 0 &&
    allDifferentialsHaveCitations(differentials) &&
    (pack.chunks.length === 0 || citationCoverage(pack) > 0);

  const failClosed = shouldFailClosed({
    confidence,
    routingAction: pack.routingDecision.action,
    hasGroundedCitations: hasCitations,
  });

  const gseParams: GseEvaluateParams = {
    query: {
      ...params.query,
      profileId: AI_DOCTOR_RETRIEVAL_PROFILE,
      taskType: AI_DOCTOR_TASK_TYPE,
      expectedConfidence: params.query.expectedConfidence ?? {
        pack: { min: 0.55, max: 0.95 },
        chunksTop4: { min: 0.55, max: 1.0 },
        minEvidenceLevel: 'L2',
      },
    },
    pack,
    differentials,
    caseConfidence: confidence,
    escalationRecommended: shouldRecommendEscalation(confidence),
    humanRedirect: failClosed || shouldRecommendEscalation(confidence),
    refused: failClosed || pack.routingDecision.action === 'BLOCK',
    ...(params.options?.corpusUnavailable !== undefined
      ? { corpusUnavailable: params.options.corpusUnavailable }
      : {}),
  };

  const result = evaluateGseRecord(gseParams);

  return {
    ...result,
    query: params.query.query,
    profileId: AI_DOCTOR_RETRIEVAL_PROFILE,
    species,
    chunkCount: pack.chunks.length,
    differentialCount: differentials.length,
    caseScore: confidence.caseScore,
    confidenceTier: confidence.tier,
    failClosed,
    escalationRecommended: shouldRecommendEscalation(confidence),
    humanRedirect: failClosed || shouldRecommendEscalation(confidence),
    colloquialExpanded: normalized.colloquialExpanded,
    latencyMs: pack.scores.totalMs,
    assistantMode: 'differential',
  };
}

function buildRowFromAnalyzeResult(
  query: GoldenEvalRecord,
  analyze: AnalyzeCaseResult,
  species: LivestockSpecies,
): AiDoctorEvalRow {
  const pack = analyze.pack;
  if (!pack) {
    const emptyPack = emptyKnowledgePack(query);
    const result = evaluateGseRecord({
      query,
      pack: emptyPack,
      differentials: analyze.differentials,
      caseConfidence: analyze.confidence,
      assistantOutput: analyze.content,
      disclaimerPresent: analyze.disclaimer.length > 0,
      escalationRecommended: analyze.escalationRecommended,
      humanRedirect: analyze.humanRedirect,
      refused: analyze.refused,
    });
    return {
      ...result,
      query: query.query,
      profileId: AI_DOCTOR_RETRIEVAL_PROFILE,
      species,
      chunkCount: 0,
      differentialCount: analyze.differentials.length,
      caseScore: analyze.confidence.caseScore,
      confidenceTier: analyze.confidence.tier,
      failClosed: analyze.confidence.failClosed,
      escalationRecommended: analyze.escalationRecommended,
      humanRedirect: analyze.humanRedirect,
      colloquialExpanded: false,
      latencyMs: 0,
      assistantMode: 'full-analyze',
    };
  }

  const result = evaluateGseRecord({
    query,
    pack,
    differentials: analyze.differentials,
    caseConfidence: analyze.confidence,
    assistantOutput: analyze.content,
    disclaimerPresent: analyze.disclaimer.length > 0,
    escalationRecommended: analyze.escalationRecommended,
    humanRedirect: analyze.humanRedirect,
    refused: analyze.refused,
  });

  return {
    ...result,
    query: query.query,
    profileId: AI_DOCTOR_RETRIEVAL_PROFILE,
    species,
    chunkCount: pack.chunks.length,
    differentialCount: analyze.differentials.length,
    caseScore: analyze.confidence.caseScore,
    confidenceTier: analyze.confidence.tier,
    failClosed: analyze.confidence.failClosed,
    escalationRecommended: analyze.escalationRecommended,
    humanRedirect: analyze.humanRedirect,
    colloquialExpanded: false,
    latencyMs: pack.scores.totalMs,
    assistantMode: 'full-analyze',
  };
}

function emptyKnowledgePack(query: GoldenEvalRecord): KnowledgeContextPack {
  return {
    packId: 'empty',
    taskType: AI_DOCTOR_TASK_TYPE,
    locale: query.locale,
    query: query.query,
    normalizedQuery: query.query,
    retrievedAt: new Date().toISOString(),
    retrievalProfileId: AI_DOCTOR_RETRIEVAL_PROFILE,
    retrievalMode: 'lexical',
    chunks: [],
    entities: [],
    structuredFacts: [],
    citationBlock: '',
    evidenceBlock: '',
    confidenceBlock: '',
    groundingInstruction: '',
    graphHints: [],
    filtersApplied: {
      domainPriority: ['DISEASE'],
      minConfidence: 0,
      minEvidenceLevel: 'L5',
      regionScope: 'BD',
      status: 'PUBLISHED',
    },
    confidenceSummary: { avg: 0, min: 0, max: 0 },
    evidenceSummary: { min: 'L5', max: 'L5', dominant: 'L5' },
    excludedCount: 0,
    embeddingCoverage: 0,
    routingDecision: {
      action: 'BLOCK',
      reason: 'empty',
      failClosed: true,
      disclaimerLevel: 'blocking',
      medicalRiskTier: 'HIGH',
    },
    scores: {
      lexicalMs: 0,
      semanticMs: 0,
      fusionMs: 0,
      rerankMs: 0,
      rankMs: 0,
      packBuildMs: 0,
      totalMs: 0,
    },
  };
}

export function summarizeAiDoctorEval(rows: AiDoctorEvalRow[]): {
  total: number;
  passed: number;
  passRate: number;
  avgCompositeScore: number;
  avgCaseScore: number;
  avgPrecisionAt4: number;
  failClosedRate: number;
  escalationRate: number;
} {
  const total = rows.length;
  const passed = rows.filter((r) => r.passed).length;
  return {
    total,
    passed,
    passRate: total > 0 ? passed / total : 0,
    avgCompositeScore:
      total > 0 ? rows.reduce((s, r) => s + r.compositeScore, 0) / total : 0,
    avgCaseScore: total > 0 ? rows.reduce((s, r) => s + r.caseScore, 0) / total : 0,
    avgPrecisionAt4:
      total > 0 ? rows.reduce((s, r) => s + r.precisionAt4, 0) / total : 0,
    failClosedRate: total > 0 ? rows.filter((r) => r.failClosed).length / total : 0,
    escalationRate:
      total > 0 ? rows.filter((r) => r.escalationRecommended).length / total : 0,
  };
}
