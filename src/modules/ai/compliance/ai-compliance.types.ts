/** AI compliance metadata — docs/launch/ai-compliance-plan.md */

export type AiComplianceFeature =
  | 'chat'
  | 'triage'
  | 'symptom_check'
  | 'recommendations'
  | 'farm_health'
  | 'knowledge'
  | 'briefing'
  | 'farm_query';

export type AiComplianceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type AiComplianceMetadata = {
  feature: AiComplianceFeature;
  riskLevel: AiComplianceRiskLevel;
  emergency: boolean;
  escalationRequired: boolean;
  showUrgentBanner: boolean;
  showEscalationStrip: boolean;
  complianceVersion: string;
  disclaimerVersion?: string;
};

export type AiComplianceRulesConfig = {
  contentVersion: string;
  enabled: boolean;
  auditEnabled: boolean;
  emergencyDetectionEnabled: boolean;
};

export type AiComplianceAuditInput = {
  userId?: string;
  sessionId?: string;
  feature: AiComplianceFeature;
  riskLevel: AiComplianceRiskLevel;
  emergency: boolean;
  escalationRequired: boolean;
  complianceVersion: string;
  event: 'RESPONSE_GENERATED' | 'EMERGENCY_TRIGGERED' | 'ESCALATION_TRIGGERED';
};
