import {
  AiEscalationReason,
  AiEscalationStatus,
} from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getAiVeterinaryRepository } from '../../../ai-veterinary-core/repository/ai-veterinary.repository.js';

import type {
  EscalationTriggerContext,
  EscalationType,
  UrgencyTier,
} from '../ai-doctor.types.js';

export function resolveEscalationType(context: EscalationTriggerContext): EscalationType {
  if (context.userRequested) return 'VET_BOOKING';
  if (context.emergency || context.urgencyTier === 'CRITICAL') return 'VET_CALL_NOW';
  if (context.routingAction === 'BLOCK' || context.policyRefusal) return 'ASYNC_VET_REVIEW';
  if (context.caseConfidence < 0.55) return 'ASYNC_VET_REVIEW';
  return 'VET_BOOKING';
}

export function resolveEscalationReason(context: EscalationTriggerContext): AiEscalationReason {
  if (context.emergency || context.urgencyTier === 'CRITICAL') {
    return AiEscalationReason.EMERGENCY_SYMPTOM;
  }
  if (context.policyRefusal) return AiEscalationReason.POLICY_REFUSAL;
  if (context.routingAction === 'BLOCK') return AiEscalationReason.HIGH_RISK;
  if (context.caseConfidence < 0.55) return AiEscalationReason.LOW_CONFIDENCE;
  if (context.userRequested) return AiEscalationReason.DOCTOR_REQUEST;
  return AiEscalationReason.HIGH_RISK;
}

export function escalationHandoffNote(params: {
  escalationType: EscalationType;
  urgencyTier: UrgencyTier;
  caseId: string;
  trigger: string;
}): string {
  return `AI Doctor escalation: ${params.escalationType} (${params.urgencyTier}) case=${params.caseId} trigger=${params.trigger}`;
}

export class VetEscalationEngine {
  readonly name = 'VetEscalationEngine';

  resolveType = resolveEscalationType;
  resolveReason = resolveEscalationReason;

  async createEscalation(params: {
    userId: string;
    sessionId?: string;
    caseId: string;
    context: EscalationTriggerContext;
    triggerRuleId: string;
  }): Promise<{ escalationId: string; escalationType: EscalationType }> {
    const repo = getAiVeterinaryRepository();
    const escalationType = resolveEscalationType(params.context);
    const reason = resolveEscalationReason(params.context);
    const handoffNote = escalationHandoffNote({
      escalationType,
      urgencyTier: params.context.urgencyTier,
      caseId: params.caseId,
      trigger: params.triggerRuleId,
    });

    const record = await repo.createEscalation(
      omitUndefined({
        userId: params.userId,
        sessionId: params.sessionId,
        caseId: params.caseId,
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

let engine: VetEscalationEngine | null = null;

export function getVetEscalationEngine(): VetEscalationEngine {
  if (!engine) engine = new VetEscalationEngine();
  return engine;
}

export function resetVetEscalationEngineForTests(): void {
  engine = null;
}
