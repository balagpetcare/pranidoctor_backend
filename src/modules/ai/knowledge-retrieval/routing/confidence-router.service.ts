import type {
  AiKnowledgeContentType,
  AiKnowledgeEvidenceLevel,
} from '../../../../generated/prisma/index.js';
import type {
  ConfidenceRoutingDecision,
  RetrievalProfile,
  RetrievedChunk,
  StructuredFact,
} from '../knowledge-retrieval.types.js';
import { EVIDENCE_ORDER } from '../knowledge-retrieval.types.js';
import { resolveStructuredRecord } from '../search/lexical-scoring.util.js';
import { evaluateMedicalSafety } from '../grounding/medical-safety.service.js';
import { applyLowConfidencePolicy } from '../grounding/low-confidence.handler.js';

export { buildKnowledgeContextPack } from '../packs/context-pack-builder.js';
export { isHighClinicalRisk } from '../grounding/medical-safety.service.js';

export function extractStructuredFacts(params: {
  knowledgeEntryId: string;
  contentType: AiKnowledgeContentType;
  metadataJson: unknown;
  evidenceLevel: AiKnowledgeEvidenceLevel;
  confidenceScore: number;
  inlineCitation: string;
}): StructuredFact[] {
  const record = resolveStructuredRecord(params.metadataJson);
  if (!record) return [];

  const facts: StructuredFact[] = [];

  if (typeof record.doseMgKg === 'number') {
    facts.push({
      factId: `${params.knowledgeEntryId}:dose`,
      domain: params.contentType,
      factType: 'DOSE_MG_KG',
      value: record.doseMgKg,
      unit: 'mg/kg',
      evidenceLevel: params.evidenceLevel,
      confidenceScore: params.confidenceScore,
      sourceCitation: params.inlineCitation,
    });
  }

  if (typeof record.doseMlKg === 'number') {
    facts.push({
      factId: `${params.knowledgeEntryId}:dose-ml`,
      domain: params.contentType,
      factType: 'DOSE_ML_KG',
      value: record.doseMlKg,
      unit: 'ml/kg',
      evidenceLevel: params.evidenceLevel,
      confidenceScore: params.confidenceScore,
      sourceCitation: params.inlineCitation,
    });
  }

  if (typeof record.withdrawalDays === 'number') {
    facts.push({
      factId: `${params.knowledgeEntryId}:withdrawal`,
      domain: params.contentType,
      factType: 'WITHDRAWAL_DAYS',
      value: record.withdrawalDays,
      unit: 'days',
      evidenceLevel: params.evidenceLevel,
      confidenceScore: params.confidenceScore,
      sourceCitation: params.inlineCitation,
    });
  }

  if (typeof record.withdrawalMeatDays === 'number') {
    facts.push({
      factId: `${params.knowledgeEntryId}:withdrawal-meat`,
      domain: params.contentType,
      factType: 'WITHDRAWAL_DAYS',
      value: record.withdrawalMeatDays,
      unit: 'days',
      evidenceLevel: params.evidenceLevel,
      confidenceScore: params.confidenceScore,
      sourceCitation: params.inlineCitation,
    });
  }

  if (record.bannedSubstance === true) {
    facts.push({
      factId: `${params.knowledgeEntryId}:banned`,
      domain: params.contentType,
      factType: 'BANNED_SUBSTANCE',
      value: true,
      evidenceLevel: params.evidenceLevel,
      confidenceScore: params.confidenceScore,
      sourceCitation: params.inlineCitation,
    });
  }

  const matrix = record.speciesDoseMatrix;
  if (Array.isArray(matrix)) {
    for (let i = 0; i < matrix.length; i += 1) {
      const row = matrix[i];
      if (!row || typeof row !== 'object') continue;
      const doseRow = row as Record<string, unknown>;
      if (typeof doseRow.doseMgPerKg === 'number') {
        facts.push({
          factId: `${params.knowledgeEntryId}:matrix-dose:${i}`,
          domain: params.contentType,
          factType: 'DOSE_MG_KG',
          value: doseRow.doseMgPerKg,
          unit: 'mg/kg',
          evidenceLevel: params.evidenceLevel,
          confidenceScore: params.confidenceScore,
          sourceCitation: params.inlineCitation,
          ...(typeof doseRow.species === 'string'
            ? { species: doseRow.species as import('../../../../generated/prisma/index.js').LivestockSpecies }
            : {}),
        });
      }
    }
  }

  return facts;
}

export function decideConfidenceRouting(params: {
  profile: RetrievalProfile;
  query: string;
  chunks: RetrievedChunk[];
  structuredFacts: StructuredFact[];
  embeddingCoverage: number;
  semanticEnabled: boolean;
  emergencyFlag?: boolean;
}): ConfidenceRoutingDecision {
  const medicalDecision = evaluateMedicalSafety({
    profile: params.profile,
    query: params.query,
    taskType: params.profile.taskType,
    chunks: params.chunks,
    structuredFacts: params.structuredFacts,
    embeddingCoverage: params.embeddingCoverage,
    semanticEnabled: params.semanticEnabled,
    ...(params.emergencyFlag !== undefined ? { emergencyFlag: params.emergencyFlag } : {}),
  });

  if (medicalDecision.action === 'BLOCK') {
    return medicalDecision;
  }

  return applyLowConfidencePolicy({
    profile: params.profile,
    chunks: params.chunks,
    structuredFacts: params.structuredFacts,
    embeddingCoverage: params.embeddingCoverage,
    semanticEnabled: params.semanticEnabled,
    baseDecision:
      medicalDecision.action === 'PROCEED_DEGRADED'
        ? medicalDecision
        : {
            action: 'PROCEED',
            reason: medicalDecision.reason,
            failClosed: params.profile.failClosed,
            disclaimerLevel: 'standard',
            medicalRiskTier: medicalDecision.medicalRiskTier,
          },
  });
}

export function passesEvidenceFloor(
  level: AiKnowledgeEvidenceLevel,
  min: AiKnowledgeEvidenceLevel,
): boolean {
  return EVIDENCE_ORDER.indexOf(level) >= EVIDENCE_ORDER.indexOf(min);
}
