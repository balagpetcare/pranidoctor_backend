import {
  AiEscalationReason,
  AiEscalationStatus,
} from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getAiVeterinaryRepository } from '../../../ai-veterinary-core/repository/ai-veterinary.repository.js';

import type { EscalationType, SessionConfidence, VaccineSafetyReport } from '../ai-vaccine.types.js';

export function resolveVaccineEscalationType(params: {
  safetyReport: VaccineSafetyReport;
  confidence: SessionConfidence;
  userRequested?: boolean;
  routingBlocked?: boolean;
}): EscalationType {
  if (params.userRequested) return 'VET_BOOKING';
  if (params.safetyReport.overallRisk === 'CRITICAL') return 'VET_CALL_NOW';
  if (params.routingBlocked || params.confidence.failClosed) return 'ASYNC_VET_REVIEW';
  if (params.safetyReport.escalationType) return params.safetyReport.escalationType;
  return 'VET_BOOKING';
}

export function resolveVaccineEscalationReason(params: {
  safetyReport: VaccineSafetyReport;
  userRequested?: boolean;
}): AiEscalationReason {
  if (params.userRequested) return AiEscalationReason.DOCTOR_REQUEST;
  if (params.safetyReport.blockReasons.includes('VACCINE_SCHEDULE_BLOCK')) {
    return AiEscalationReason.POLICY_REFUSAL;
  }
  if (params.safetyReport.overallRisk === 'CRITICAL') return AiEscalationReason.EMERGENCY_SYMPTOM;
  return AiEscalationReason.HIGH_RISK;
}

export class VaccineEscalationEngine {
  readonly name = 'VaccineEscalationEngine';

  async createEscalation(params: {
    userId: string;
    sessionId?: string;
    vaccineSessionId: string;
    safetyReport: VaccineSafetyReport;
    confidence: SessionConfidence;
    triggerRuleId: string;
    userRequested?: boolean;
    routingBlocked?: boolean;
  }): Promise<{ escalationId: string; escalationType: EscalationType }> {
    const repo = getAiVeterinaryRepository();
    const escalationType = resolveVaccineEscalationType(
      omitUndefined({
        safetyReport: params.safetyReport,
        confidence: params.confidence,
        userRequested: params.userRequested,
        routingBlocked: params.routingBlocked,
      }),
    );
    const reason = resolveVaccineEscalationReason(
      omitUndefined({
        safetyReport: params.safetyReport,
        userRequested: params.userRequested,
      }),
    );

    const handoffNote = `Vaccine escalation: ${escalationType} session=${params.vaccineSessionId} trigger=${params.triggerRuleId} risk=${params.safetyReport.overallRisk}`;

    const record = await repo.createEscalation(
      omitUndefined({
        userId: params.userId,
        sessionId: params.sessionId,
        caseId: params.vaccineSessionId,
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

let engine: VaccineEscalationEngine | null = null;

export function getVaccineEscalationEngine(): VaccineEscalationEngine {
  if (!engine) engine = new VaccineEscalationEngine();
  return engine;
}

export function resetVaccineEscalationEngineForTests(): void {
  engine = null;
}
