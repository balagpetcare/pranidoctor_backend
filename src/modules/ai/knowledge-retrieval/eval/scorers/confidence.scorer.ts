import type { KnowledgeContextPack } from '../../knowledge-retrieval.types.js';
import type { CaseConfidence } from '../../../ai-doctor/ai-doctor.types.js';
import type { DimensionScore, GoldenEvalRecord } from '../golden-set.types.js';

const EVIDENCE_ORDER = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;

function evidenceMeetsMin(actual: string, min: string): boolean {
  const aIdx = EVIDENCE_ORDER.indexOf(actual as (typeof EVIDENCE_ORDER)[number]);
  const mIdx = EVIDENCE_ORDER.indexOf(min as (typeof EVIDENCE_ORDER)[number]);
  if (aIdx < 0 || mIdx < 0) return true;
  return aIdx <= mIdx;
}

export function scoreConfidence(params: {
  query: GoldenEvalRecord;
  pack: KnowledgeContextPack;
  caseConfidence?: CaseConfidence;
}): DimensionScore {
  const violations: string[] = [];
  const spec = params.query.expectedConfidence;
  const packAvg = params.pack.confidenceSummary.avg;
  const packBand = spec?.pack ?? { min: 0.35, max: 0.98 };

  const top4Scores = params.pack.chunks.slice(0, 4).map((c) => c.confidenceScore);
  const top4Avg =
    top4Scores.length > 0 ? top4Scores.reduce((a, b) => a + b, 0) / top4Scores.length : 0;
  const chunkBand = spec?.chunksTop4 ?? { min: 0.35, max: 1.0 };

  const expectedRouting = params.query.expectedEscalation?.routing ?? params.query.expectedRouting;
  const inPackBand =
    packAvg >= packBand.min &&
    packAvg <= packBand.max &&
    (expectedRouting !== 'PROCEED' || params.pack.chunks.length === 0 || packAvg >= packBand.min);

  if (params.pack.chunks.length > 0 && expectedRouting === 'PROCEED') {
    if (packAvg < packBand.min) {
      violations.push(`pack confidence ${packAvg.toFixed(2)} below min ${packBand.min}`);
    }
    if (packAvg > packBand.max) {
      violations.push(`pack confidence ${packAvg.toFixed(2)} above max ${packBand.max}`);
    }
  }

  if (top4Scores.length > 0) {
    if (top4Avg < chunkBand.min) {
      violations.push(`top-4 chunk confidence ${top4Avg.toFixed(2)} below min ${chunkBand.min}`);
    }
    if (top4Avg > chunkBand.max) {
      violations.push(`top-4 chunk confidence ${top4Avg.toFixed(2)} above max ${chunkBand.max}`);
    }
  }

  const minEvidence = spec?.minEvidenceLevel;
  if (minEvidence && params.pack.chunks.length > 0) {
    const topEvidence = params.pack.chunks[0]?.evidenceLevel ?? 'L5';
    if (!evidenceMeetsMin(topEvidence, minEvidence)) {
      violations.push(`evidence ${topEvidence} below required ${minEvidence}`);
    }
  }

  if (params.caseConfidence && expectedRouting === 'PROCEED') {
    if (params.caseConfidence.failClosed && params.pack.chunks.length > 0) {
      violations.push(`case confidence fail-closed at ${params.caseConfidence.caseScore}`);
    }
  }

  if (spec?.allowProvisional === false && params.pack.routingDecision.action === 'PROCEED_DEGRADED') {
    violations.push('provisional/degraded routing not allowed');
  }

  const packBandScore = inPackBand || params.pack.chunks.length === 0 ? 100 : 50;
  const chunkBandScore =
    top4Scores.length === 0
      ? 100
      : top4Avg >= chunkBand.min && top4Avg <= chunkBand.max
        ? 100
        : 50;
  const caseScore = params.caseConfidence
    ? Math.round(params.caseConfidence.caseScore * 100)
    : Math.round(packAvg * 100);

  const score = Math.round(packBandScore * 0.4 + chunkBandScore * 0.3 + caseScore * 0.3);

  return {
    dimension: 'confidence',
    score,
    passed: violations.length === 0,
    weight: 0.15,
    violations,
    metrics: {
      packConfidenceAvg: packAvg,
      top4ConfidenceAvg: top4Avg,
      packBandMin: packBand.min,
      packBandMax: packBand.max,
      caseScore: params.caseConfidence?.caseScore ?? -1,
      confidenceTier: params.caseConfidence?.tier ?? 'none',
    },
  };
}
