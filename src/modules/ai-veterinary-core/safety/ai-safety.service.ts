import type { AiLocale, AiProviderInput, AiProviderOutput } from '../ai-veterinary-core.types.js';
import {
  AI_CONFIDENCE_ESCALATION_THRESHOLD,
  assessSymptomRisk,
  buildHumanRedirect,
  buildRefusalReply,
  containsDiagnosisLanguage,
  sanitizeAssistantOutput,
  shouldRefuseUserInput,
} from './ai-safety.guardrails.js';

export type SafetyEvaluation = {
  refused: boolean;
  humanRedirect: boolean;
  escalationRecommended: boolean;
  confidence: number;
  content: string;
  auditAction: string;
};

export class AiSafetyService {
  readonly name = 'AiSafetyService';

  evaluateUserInput(message: string, locale: AiLocale): SafetyEvaluation | null {
    if (!shouldRefuseUserInput(message)) return null;

    return {
      refused: true,
      humanRedirect: true,
      escalationRecommended: true,
      confidence: 1,
      content: buildRefusalReply(locale),
      auditAction: 'POLICY_REFUSAL_INPUT',
    };
  }

  evaluateProviderOutput(output: AiProviderOutput, locale: AiLocale): SafetyEvaluation {
    const sanitized = sanitizeAssistantOutput(output.content);
    const hasDiagnosis = containsDiagnosisLanguage(output.content);
    const lowConfidence = output.confidence < AI_CONFIDENCE_ESCALATION_THRESHOLD;

    return {
      refused: hasDiagnosis,
      humanRedirect: hasDiagnosis || lowConfidence,
      escalationRecommended: lowConfidence,
      confidence: output.confidence,
      content: hasDiagnosis ? buildRefusalReply(locale) : sanitized,
      auditAction: hasDiagnosis ? 'OUTPUT_GUARDRAIL_REFUSAL' : lowConfidence ? 'LOW_CONFIDENCE' : 'OUTPUT_OK',
    };
  }

  evaluateTriage(symptoms: string[]): {
    bucket: 'LOW' | 'MEDIUM' | 'HIGH';
    urgencyLevel: number;
    escalationRequired: boolean;
    recommendation: string;
    auditAction: string;
  } {
    const risk = assessSymptomRisk(symptoms);
    const escalationRequired = risk.bucket === 'HIGH';

    let recommendation = 'Monitor the animal and keep notes of symptoms.';
    if (risk.emergency) {
      recommendation = 'Seek immediate veterinary care — possible emergency.';
    } else if (risk.bucket === 'HIGH') {
      recommendation = 'Contact a veterinarian as soon as possible.';
    } else if (risk.bucket === 'MEDIUM') {
      recommendation = 'Schedule a veterinarian visit if symptoms persist.';
    }

    return {
      bucket: risk.bucket,
      urgencyLevel: risk.urgencyLevel,
      escalationRequired,
      recommendation: `${recommendation} ${buildHumanRedirect('en')}`,
      auditAction: escalationRequired ? 'TRIAGE_ESCALATION' : 'TRIAGE_OK',
    };
  }
}

let safetyService: AiSafetyService | null = null;

export function getAiSafetyService(): AiSafetyService {
  if (!safetyService) safetyService = new AiSafetyService();
  return safetyService;
}

export type { AiProviderInput, AiProviderOutput };
