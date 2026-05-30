import { loadAiDisclaimerConfig } from '../../../legacy/web/lib/ai-disclaimer/ai-disclaimer-config.js';
import { loadAiComplianceConfig } from '../../../legacy/web/lib/ai-compliance/ai-compliance-config.js';
import { getAiVeterinaryRepository } from '../../ai-veterinary-core/repository/ai-veterinary.repository.js';
import type {
  AiComplianceAuditInput,
  AiComplianceFeature,
  AiComplianceMetadata,
  AiComplianceRiskLevel,
  AiComplianceRulesConfig,
} from './ai-compliance.types.js';

export function mapBucketToComplianceRisk(
  bucket: 'LOW' | 'MEDIUM' | 'HIGH',
): AiComplianceRiskLevel {
  return bucket;
}

export async function buildAiComplianceMetadata(input: {
  feature: AiComplianceFeature;
  riskLevel: AiComplianceRiskLevel;
  emergency: boolean;
  escalationRequired: boolean;
}): Promise<AiComplianceMetadata> {
  const [rules, disclaimerConfig] = await Promise.all([
    loadAiComplianceConfig(),
    loadAiDisclaimerConfig(),
  ]);

  const enabled = rules.enabled;
  const emergency = rules.emergencyDetectionEnabled ? input.emergency : false;
  const escalationRequired = enabled ? input.escalationRequired : false;

  return {
    feature: input.feature,
    riskLevel: input.riskLevel,
    emergency,
    escalationRequired,
    showUrgentBanner: enabled && emergency,
    showEscalationStrip: enabled && escalationRequired,
    complianceVersion: rules.contentVersion,
    disclaimerVersion: disclaimerConfig.contentVersion,
  };
}

function auditActionForEvent(event: AiComplianceAuditInput['event']): string {
  switch (event) {
    case 'EMERGENCY_TRIGGERED':
      return 'COMPLIANCE_EMERGENCY_TRIGGERED';
    case 'ESCALATION_TRIGGERED':
      return 'COMPLIANCE_ESCALATION_TRIGGERED';
    default:
      return 'COMPLIANCE_RESPONSE_GENERATED';
  }
}

export async function recordAiComplianceAudit(input: AiComplianceAuditInput): Promise<void> {
  const rules = await loadAiComplianceConfig();
  if (!rules.auditEnabled) return;

  const repo = getAiVeterinaryRepository();
  await repo.writeAudit({
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    action: auditActionForEvent(input.event),
    detailJson: {
      feature: input.feature,
      riskLevel: input.riskLevel,
      emergency: input.emergency,
      escalationRequired: input.escalationRequired,
      complianceVersion: input.complianceVersion,
      event: input.event,
      recordedAt: new Date().toISOString(),
    },
  });
}

export async function attachComplianceToResponse<T extends Record<string, unknown>>(
  base: T,
  input: {
    userId?: string;
    sessionId?: string;
    feature: AiComplianceFeature;
    riskLevel: AiComplianceRiskLevel;
    emergency: boolean;
    escalationRequired: boolean;
  },
): Promise<T & { compliance: AiComplianceMetadata; emergency: boolean }> {
  const compliance = await buildAiComplianceMetadata(input);

  const events: AiComplianceAuditInput['event'][] = ['RESPONSE_GENERATED'];
  if (compliance.emergency) events.push('EMERGENCY_TRIGGERED');
  if (compliance.escalationRequired) events.push('ESCALATION_TRIGGERED');

  for (const event of events) {
    await recordAiComplianceAudit({
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      feature: input.feature,
      riskLevel: input.riskLevel,
      emergency: compliance.emergency,
      escalationRequired: compliance.escalationRequired,
      complianceVersion: compliance.complianceVersion,
      event,
    });
  }

  return {
    ...base,
    emergency: compliance.emergency,
    compliance,
  };
}
