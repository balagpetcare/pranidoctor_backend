import {
  AiEscalationReason,
  AiEscalationStatus,
} from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getAiVeterinaryRepository } from '../../../ai-veterinary-core/repository/ai-veterinary.repository.js';

import type { EscalationType, PrescriptionSafetyReport, SessionConfidence } from '../ai-prescription.types.js';

export function resolvePrescriptionEscalationType(params: {
  safetyReport: PrescriptionSafetyReport;
  confidence: SessionConfidence;
  userRequested?: boolean;
  routingBlocked?: boolean;
}): EscalationType {
  if (params.userRequested) return 'VET_BOOKING';
  if (params.safetyReport.blockReasons.includes('BANNED_SUBSTANCE')) {
    return 'REGULATORY_REFERRAL';
  }
  if (params.safetyReport.overallRisk === 'CRITICAL') return 'VET_CALL_NOW';
  if (params.routingBlocked || params.confidence.failClosed) return 'ASYNC_VET_REVIEW';
  if (params.safetyReport.escalationType) return params.safetyReport.escalationType;
  return 'VET_BOOKING';
}

export function resolvePrescriptionEscalationReason(params: {
  safetyReport: PrescriptionSafetyReport;
  userRequested?: boolean;
}): AiEscalationReason {
  if (params.userRequested) return AiEscalationReason.DOCTOR_REQUEST;
  if (params.safetyReport.blockReasons.includes('BANNED_SUBSTANCE')) {
    return AiEscalationReason.POLICY_REFUSAL;
  }
  if (params.safetyReport.overallRisk === 'CRITICAL') return AiEscalationReason.EMERGENCY_SYMPTOM;
  return AiEscalationReason.HIGH_RISK;
}

export class PrescriptionEscalationEngine {
  readonly name = 'PrescriptionEscalationEngine';

  async createEscalation(params: {
    userId: string;
    sessionId?: string;
    prescriptionSessionId: string;
    safetyReport: PrescriptionSafetyReport;
    confidence: SessionConfidence;
    triggerRuleId: string;
    userRequested?: boolean;
    routingBlocked?: boolean;
  }): Promise<{ escalationId: string; escalationType: EscalationType }> {
    const repo = getAiVeterinaryRepository();
    const escalationType = resolvePrescriptionEscalationType(
      omitUndefined({
        safetyReport: params.safetyReport,
        confidence: params.confidence,
        userRequested: params.userRequested,
        routingBlocked: params.routingBlocked,
      }),
    );
    const reason = resolvePrescriptionEscalationReason(
      omitUndefined({
        safetyReport: params.safetyReport,
        userRequested: params.userRequested,
      }),
    );

    const handoffNote = `Prescription escalation: ${escalationType} session=${params.prescriptionSessionId} trigger=${params.triggerRuleId} risk=${params.safetyReport.overallRisk}`;

    const record = await repo.createEscalation(
      omitUndefined({
        userId: params.userId,
        sessionId: params.sessionId,
        caseId: params.prescriptionSessionId,
        reason,
        handoffNote,
        status: AiEscalationStatus.PENDING_REVIEW,
      }),
    );

    if (params.sessionId) {
      await repo.markSessionEscalated(params.sessionId);
    }

    return { escalationId: record.id, escalationType };
  }
}

let engine: PrescriptionEscalationEngine | null = null;

export function getPrescriptionEscalationEngine(): PrescriptionEscalationEngine {
  if (!engine) engine = new PrescriptionEscalationEngine();
  return engine;
}

export function resetPrescriptionEscalationEngineForTests(): void {
  engine = null;
}
