import { prisma } from '@/lib/prisma';

import {
  AI_ESCALATION_DISCLOSURE_SETTING_KEY,
  DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG,
  parseAiEscalationDisclosureConfigJson,
  type AiEscalationDisclosureConfig,
} from './ai-escalation-disclosure-defaults.js';

export async function loadAiEscalationDisclosureConfig(): Promise<AiEscalationDisclosureConfig> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: AI_ESCALATION_DISCLOSURE_SETTING_KEY },
      select: { valueJson: true },
    });
    if (row?.valueJson != null) {
      return parseAiEscalationDisclosureConfigJson(row.valueJson);
    }
  } catch {
    /* optional */
  }
  return {
    ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG,
    banner: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.banner },
    full: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.full },
    contextual: {
      emergency: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.emergency },
      high: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.high },
      lowConfidence: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.lowConfidence },
      policyRefusal: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.policyRefusal },
      supportVsVet: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.supportVsVet },
      humanReview: { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.humanReview },
      escalationRecorded: {
        ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.escalationRecorded,
      },
      keywordLimitation: {
        ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contextual.keywordLimitation,
      },
    },
  };
}

export { AI_ESCALATION_DISCLOSURE_SETTING_KEY };
