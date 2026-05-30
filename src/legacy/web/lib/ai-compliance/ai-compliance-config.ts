import { prisma } from '@/lib/prisma';

import {
  AI_COMPLIANCE_SETTING_KEY,
  DEFAULT_AI_COMPLIANCE_CONFIG,
  parseAiComplianceConfigJson,
} from '../../../../modules/ai/compliance/ai-compliance.defaults.js';
import type { AiComplianceRulesConfig } from '../../../../modules/ai/compliance/ai-compliance.types.js';

export { AI_COMPLIANCE_SETTING_KEY };

export async function loadAiComplianceConfig(): Promise<AiComplianceRulesConfig> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: AI_COMPLIANCE_SETTING_KEY },
      select: { valueJson: true },
    });
    if (row?.valueJson != null) {
      return parseAiComplianceConfigJson(row.valueJson);
    }
  } catch {
    /* optional */
  }
  return { ...DEFAULT_AI_COMPLIANCE_CONFIG };
}

export async function saveAiComplianceConfig(
  config: AiComplianceRulesConfig,
): Promise<AiComplianceRulesConfig> {
  await prisma.setting.upsert({
    where: { key: AI_COMPLIANCE_SETTING_KEY },
    create: { key: AI_COMPLIANCE_SETTING_KEY, valueJson: config as never },
    update: { valueJson: config as never },
  });
  return config;
}
