import { Counter } from './prometheus-series.js';
import { isHttpMetricsEnabled } from './monitoring-config.js';

const authFailuresTotal = new Counter();
const securityEventsTotal = new Counter();

export type AuthFailureInput = {
  surface: string;
  action: string;
  channel?: string;
};

export function recordAuthFailure(input: AuthFailureInput): void {
  if (!isHttpMetricsEnabled()) return;
  authFailuresTotal.inc({
    surface: input.surface,
    action: input.action,
    channel: input.channel ?? 'unknown',
  });
}

export function recordSecurityEvent(event: string, severity: 'info' | 'warning' | 'critical'): void {
  if (!isHttpMetricsEnabled()) return;
  securityEventsTotal.inc({ event, severity });
}

export function renderSecurityPrometheusLines(): string[] {
  return [
    ...authFailuresTotal.entries(
      'pranidoctor_auth_failures_total',
      'Authentication and authorization failures by surface and action',
    ),
    ...securityEventsTotal.entries(
      'pranidoctor_security_events_total',
      'Security-related events by type and severity',
    ),
  ];
}

export function resetSecurityMetricsForTests(): void {
  authFailuresTotal.clear();
  securityEventsTotal.clear();
}
