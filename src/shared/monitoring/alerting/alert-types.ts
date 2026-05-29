/** Shared alert severity tiers for production webhook delivery. */
export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertTier = 'critical' | 'warning' | 'informational';

export type AlertEscalation = {
  repeatCount: number;
  escalated: boolean;
  escalationLevel: number;
  deduplicated: boolean;
};

export type ProductionAlertInput = {
  /** Stable id from alerting-plan.md (e.g. ALT-DOWN-02). */
  alertId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
  /** Optional sub-key for dedup (route, dependency name). */
  fingerprint?: string;
  runbook?: string;
};

export type ProductionAlertPayload = {
  event: 'production.alert';
  alertId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  tier: AlertTier;
  service: string;
  environment: string;
  version: string;
  timestamp: string;
  escalation: AlertEscalation;
  runbook?: string;
  metadata?: Record<string, unknown>;
};

export function severityToTier(severity: AlertSeverity): AlertTier {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'warning';
    default:
      return 'informational';
  }
}

export const DEFAULT_RUNBOOK = 'docs/incident-response-guide.md';
