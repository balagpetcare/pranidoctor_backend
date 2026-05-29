import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import {
  resetProductionAlertingForTests,
  sendProductionAlert,
} from './alert-service.js';
import { severityToTier } from './alert-types.js';

describe('severityToTier', () => {
  it('maps critical, warning, and info to tiers', () => {
    expect(severityToTier('critical')).toBe('critical');
    expect(severityToTier('warning')).toBe('warning');
    expect(severityToTier('info')).toBe('informational');
  });
});

describe('sendProductionAlert', () => {
  afterEach(() => {
    resetProductionAlertingForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns disabled when MONITORING_ENABLED=false', async () => {
    vi.stubEnv('MONITORING_ENABLED', 'false');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendProductionAlert({
      alertId: 'ALT-ERR-01',
      title: 'Test',
      message: 'Disabled',
      severity: 'warning',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes severity into webhook payload tier field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('MONITORING_ALERT_WEBHOOK_URL', 'https://hooks.example.com/alerts');

    await sendProductionAlert({
      alertId: 'ALT-ERR-01',
      title: 'API server error',
      message: 'GET /api/test — 500',
      severity: 'warning',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.severity).toBe('warning');
    expect(body.tier).toBe('warning');
    expect(body.event).toBe('production.alert');
  });

  it('escalates and re-sends after repeat threshold', async () => {
    vi.stubEnv('ALERT_DEDUP_WINDOW_MS', '600000');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('MONITORING_ALERT_WEBHOOK_URL', 'https://hooks.example.com/alerts');

    const input = {
      alertId: 'ALT-DOWN-02',
      title: 'Readiness',
      message: 'Not ready',
      severity: 'critical' as const,
    };

    let fifth;
    for (let i = 0; i < 4; i++) {
      await sendProductionAlert(input);
    }
    fifth = await sendProductionAlert(input);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fifth.sent).toBe(true);
    expect(fifth.escalation?.escalated).toBe(true);
    expect(fifth.escalation?.escalationLevel).toBe(1);

    const lastBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(lastBody.escalation.escalated).toBe(true);
    expect(lastBody.escalation.repeatCount).toBe(5);
  });

  it('falls back to log-only when no webhook configured', async () => {
    vi.stubEnv('MONITORING_ALERT_WEBHOOK_URL', '');
    vi.stubEnv('ERROR_TRACKING_WEBHOOK_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendProductionAlert({
      alertId: 'ALT-ERR-02',
      title: 'Uncaught',
      message: 'boom',
      severity: 'critical',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('no_webhook');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses fingerprint for per-route deduplication', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('MONITORING_ALERT_WEBHOOK_URL', 'https://hooks.example.com/alerts');

    await sendProductionAlert({
      alertId: 'ALT-ERR-01',
      title: '5xx',
      message: 'GET /a',
      severity: 'warning',
      fingerprint: 'GET:/a',
    });
    await sendProductionAlert({
      alertId: 'ALT-ERR-01',
      title: '5xx',
      message: 'GET /b',
      severity: 'warning',
      fingerprint: 'GET:/b',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
