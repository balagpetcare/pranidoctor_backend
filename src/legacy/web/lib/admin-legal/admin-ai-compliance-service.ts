import {
  loadAiComplianceConfig,
  saveAiComplianceConfig,
} from '../ai-compliance/ai-compliance-config.js';
import type { AiComplianceRulesConfig } from '../../../modules/ai/compliance/ai-compliance.types.js';

export type AdminAiComplianceSettings = AiComplianceRulesConfig & {
  updatedAt: string | null;
};

export async function getAdminAiComplianceSettings(): Promise<AdminAiComplianceSettings> {
  const config = await loadAiComplianceConfig();
  return {
    ...config,
    updatedAt: null,
  };
}

export async function updateAdminAiComplianceSettings(
  input: AiComplianceRulesConfig,
): Promise<AdminAiComplianceSettings> {
  const saved = await saveAiComplianceConfig(input);
  return {
    ...saved,
    updatedAt: new Date().toISOString(),
  };
}
