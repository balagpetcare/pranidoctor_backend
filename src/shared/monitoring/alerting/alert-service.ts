import { logInfo, logWarn } from '../../logger/logger.js';
import { omitUndefined } from '../../types/object.utils.js';

import {
  getAlertAppVersion,
  getAlertDedupWindowMs,
  getAlertEnvironment,
  getAlertEscalationThreshold,
  getAlertServiceName,
  getAlertStormLimit,
  getAlertWebhookUrl,
  isAlertingEnabled,
} from './alert-config.js';
import { AlertDeduplicator } from './alert-deduplicator.js';
import {
  DEFAULT_RUNBOOK,
  type AlertEscalation,
  type AlertSeverity,
  type ProductionAlertInput,
  type ProductionAlertPayload,
  severityToTier,
} from './alert-types.js';

const deduplicator = new AlertDeduplicator(
  getAlertDedupWindowMs(),
  getAlertEscalationThreshold(),
  getAlertStormLimit,
);

export type SendAlertResult = {
  sent: boolean;
  reason?: 'disabled' | 'deduplicated' | 'storm_suppressed' | 'no_webhook';
  escalation?: AlertEscalation;
};

function dedupKey(input: ProductionAlertInput): string {
  return input.fingerprint
    ? `${input.alertId}:${input.fingerprint}`
    : input.alertId;
}

function buildPayload(
  input: ProductionAlertInput,
  escalation: AlertEscalation,
): ProductionAlertPayload {
  return {
    event: 'production.alert',
    alertId: input.alertId,
    title: input.title,
    message: input.message,
    severity: input.severity,
    tier: severityToTier(input.severity),
    service: getAlertServiceName(),
    environment: getAlertEnvironment(),
    version: getAlertAppVersion(),
    timestamp: new Date().toISOString(),
    escalation,
    runbook: input.runbook ?? DEFAULT_RUNBOOK,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export async function sendProductionAlert(
  input: ProductionAlertInput,
): Promise<SendAlertResult> {
  if (!isAlertingEnabled()) {
    return { sent: false, reason: 'disabled' };
  }

  const decision = deduplicator.evaluate(dedupKey(input), input.severity);
  const escalation: AlertEscalation = {
    repeatCount: decision.repeatCount,
    escalated: decision.escalated,
    escalationLevel: decision.escalationLevel,
    deduplicated: decision.deduplicated,
  };

  if (!decision.allow) {
    if (decision.deduplicated) {
      logInfo('Alert suppressed (deduplicated)', {
        alertId: input.alertId,
        repeatCount: decision.repeatCount,
      });
      return { sent: false, reason: 'deduplicated', escalation };
    }
    if (decision.stormSuppressed) {
      logWarn('Alert suppressed (storm limit)', {
        alertId: input.alertId,
        severity: input.severity,
      });
      return { sent: false, reason: 'storm_suppressed', escalation };
    }
  }

  const webhookUrl = getAlertWebhookUrl();
  const payload = buildPayload(input, escalation);

  if (!webhookUrl) {
    logWarn(`${input.title}: ${input.message}`, {
      event: 'monitoring.alert',
      alertId: input.alertId,
      severity: input.severity,
      escalation,
      metadata: input.metadata,
    });
    return { sent: false, reason: 'no_webhook', escalation };
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { sent: true, escalation };
  } catch (error) {
    logWarn('Alert webhook delivery failed', {
      alertId: input.alertId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: 'no_webhook', escalation };
  }
}

export function sendCriticalAlert(
  alertId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
  fingerprint?: string,
): void {
  void sendProductionAlert(
    omitUndefined({
      alertId,
      title,
      message,
      severity: 'critical' as const,
      metadata,
      fingerprint,
    }),
  );
}

export function sendWarningAlert(
  alertId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
  fingerprint?: string,
): void {
  void sendProductionAlert(
    omitUndefined({
      alertId,
      title,
      message,
      severity: 'warning' as const,
      metadata,
      fingerprint,
    }),
  );
}

export function sendInformationalAlert(
  alertId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
  fingerprint?: string,
): void {
  void sendProductionAlert(
    omitUndefined({
      alertId,
      title,
      message,
      severity: 'info' as const,
      metadata,
      fingerprint,
    }),
  );
}

/** Test helper — clears dedup and storm state. */
export function resetProductionAlertingForTests(): void {
  deduplicator.reset();
}
