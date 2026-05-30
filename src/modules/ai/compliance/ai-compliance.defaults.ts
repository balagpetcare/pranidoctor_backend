import type { AiComplianceRulesConfig } from './ai-compliance.types.js';

export const AI_COMPLIANCE_SETTING_KEY = 'mobile.ai.compliance.config';

export const DEFAULT_AI_COMPLIANCE_CONFIG: AiComplianceRulesConfig = {
  contentVersion: '2026-05-30.1',
  enabled: true,
  auditEnabled: true,
  emergencyDetectionEnabled: true,
};

export function parseAiComplianceConfigJson(j: unknown): AiComplianceRulesConfig {
  if (j === null || typeof j !== 'object' || Array.isArray(j)) {
    return { ...DEFAULT_AI_COMPLIANCE_CONFIG };
  }
  const o = j as Record<string, unknown>;
  return {
    contentVersion:
      typeof o.contentVersion === 'string' && o.contentVersion.trim()
        ? o.contentVersion.trim()
        : DEFAULT_AI_COMPLIANCE_CONFIG.contentVersion,
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_AI_COMPLIANCE_CONFIG.enabled,
    auditEnabled:
      typeof o.auditEnabled === 'boolean'
        ? o.auditEnabled
        : DEFAULT_AI_COMPLIANCE_CONFIG.auditEnabled,
    emergencyDetectionEnabled:
      typeof o.emergencyDetectionEnabled === 'boolean'
        ? o.emergencyDetectionEnabled
        : DEFAULT_AI_COMPLIANCE_CONFIG.emergencyDetectionEnabled,
  };
}
