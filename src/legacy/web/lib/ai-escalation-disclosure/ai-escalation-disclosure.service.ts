import type { AiEscalationReason } from '@/generated/prisma/client';

import { loadAiEscalationDisclosureConfig } from './ai-escalation-disclosure-config.js';
import {
  pickEscalationLocaleText,
  type AiEscalationDisclosureLocale,
  type AiEscalationDisclosureTriggerKey,
} from './ai-escalation-disclosure-defaults.js';

export type AiEscalationDisclosureMobileDto = {
  contentVersion: string;
  banner: { en: string; bn: string };
  full: { en: string; bn: string };
  contextual: Record<AiEscalationDisclosureTriggerKey, { en: string; bn: string }>;
};

export type EscalationDisclosureFields = {
  escalationDisclosure: string;
  escalationTrigger: AiEscalationDisclosureTriggerKey;
  escalationDisclosureVersion: string;
};

export async function getAiEscalationDisclosureForMobile(): Promise<AiEscalationDisclosureMobileDto> {
  const config = await loadAiEscalationDisclosureConfig();
  return {
    contentVersion: config.contentVersion,
    banner: config.banner,
    full: config.full,
    contextual: config.contextual,
  };
}

export async function buildEscalationDisclosureFields(
  trigger: AiEscalationDisclosureTriggerKey,
  locale: AiEscalationDisclosureLocale,
): Promise<EscalationDisclosureFields> {
  const config = await loadAiEscalationDisclosureConfig();
  return {
    escalationDisclosure: pickEscalationLocaleText(config.contextual[trigger], locale),
    escalationTrigger: trigger,
    escalationDisclosureVersion: config.contentVersion,
  };
}

export async function resolveBannerEscalationText(
  locale: AiEscalationDisclosureLocale,
): Promise<string> {
  const config = await loadAiEscalationDisclosureConfig();
  return pickEscalationLocaleText(config.banner, locale);
}

export function mapEscalationReasonToTrigger(
  reason: AiEscalationReason,
): AiEscalationDisclosureTriggerKey {
  switch (reason) {
    case 'EMERGENCY_SYMPTOM':
      return 'emergency';
    case 'HIGH_RISK':
      return 'high';
    case 'LOW_CONFIDENCE':
      return 'lowConfidence';
    case 'POLICY_REFUSAL':
      return 'policyRefusal';
    case 'DOCTOR_REQUEST':
    default:
      return 'escalationRecorded';
  }
}

export function chatEscalationTrigger(input: {
  refused: boolean;
  escalationRecommended: boolean;
  humanRedirect: boolean;
}): AiEscalationDisclosureTriggerKey | null {
  if (input.refused) return 'policyRefusal';
  if (input.escalationRecommended) return 'lowConfidence';
  if (input.humanRedirect) return 'humanReview';
  return null;
}

export function triageEscalationTrigger(input: {
  escalationRequired: boolean;
  urgencyLevel: number;
}): AiEscalationDisclosureTriggerKey | null {
  if (!input.escalationRequired) return null;
  return input.urgencyLevel >= 10 ? 'emergency' : 'high';
}

export function symptomCheckEscalationTrigger(input: {
  escalationRequired: boolean;
  emergency: boolean;
}): AiEscalationDisclosureTriggerKey | null {
  if (!input.escalationRequired) return null;
  return input.emergency ? 'emergency' : 'high';
}

export { pickEscalationLocaleText };
