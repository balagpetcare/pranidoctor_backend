import { prisma } from '@/lib/prisma';

import {
  AI_DISCLAIMER_SETTING_KEY,
  DEFAULT_AI_DISCLAIMER_CONFIG,
  parseAiDisclaimerConfigJson,
  type AiDisclaimerConfig,
} from './ai-disclaimer-defaults.js';

export async function loadAiDisclaimerConfig(): Promise<AiDisclaimerConfig> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: AI_DISCLAIMER_SETTING_KEY },
      select: { valueJson: true },
    });
    if (row?.valueJson != null) {
      return parseAiDisclaimerConfigJson(row.valueJson);
    }
  } catch {
    /* optional */
  }
  return {
    ...DEFAULT_AI_DISCLAIMER_CONFIG,
    banner: { ...DEFAULT_AI_DISCLAIMER_CONFIG.banner },
    contextual: {
      chat: { ...DEFAULT_AI_DISCLAIMER_CONFIG.contextual.chat },
      recommendations: { ...DEFAULT_AI_DISCLAIMER_CONFIG.contextual.recommendations },
      advisory: { ...DEFAULT_AI_DISCLAIMER_CONFIG.contextual.advisory },
    },
  };
}

export { AI_DISCLAIMER_SETTING_KEY };
