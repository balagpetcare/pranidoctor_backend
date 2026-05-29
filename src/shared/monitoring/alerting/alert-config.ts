function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const v = raw?.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isAlertingEnabled(): boolean {
  return parseBool(process.env['MONITORING_ENABLED'], true);
}

/** Primary webhook; falls back to error-tracking URL for backward compatibility. */
export function getAlertWebhookUrl(): string | null {
  const primary = process.env['MONITORING_ALERT_WEBHOOK_URL']?.trim();
  if (primary) return primary;
  const fallback = process.env['ERROR_TRACKING_WEBHOOK_URL']?.trim();
  return fallback || null;
}

export function getAlertDedupWindowMs(): number {
  return parsePositiveInt(process.env['ALERT_DEDUP_WINDOW_MS'], 15 * 60 * 1000);
}

export function getAlertEscalationThreshold(): number {
  return parsePositiveInt(process.env['ALERT_ESCALATION_THRESHOLD'], 5);
}

export function getAlertStormLimit(severity: 'critical' | 'warning' | 'info'): number {
  switch (severity) {
    case 'critical':
      return parsePositiveInt(process.env['ALERT_MAX_CRITICAL_PER_MIN'], 10);
    case 'warning':
      return parsePositiveInt(process.env['ALERT_MAX_WARNING_PER_MIN'], 30);
    default:
      return parsePositiveInt(process.env['ALERT_MAX_INFO_PER_MIN'], 60);
  }
}

export function getAlertServiceName(): string {
  return process.env['SERVICE_NAME']?.trim() || 'pranidoctor-backend';
}

export function getAlertEnvironment(): string {
  return (
    process.env['APP_ENV']?.trim() ||
    process.env['NODE_ENV']?.trim() ||
    'development'
  );
}

export function getAlertAppVersion(): string {
  return process.env['APP_VERSION']?.trim() || 'unknown';
}
