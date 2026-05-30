import { getPrisma } from '../../../shared/database/prisma.js';
import { getLogger } from '../../../shared/logger/logger.js';
import { logAiPlatformEvent } from '../../../shared/monitoring/structured-logging.js';
import type { AiBudgetStatus } from '../budget/ai-budget.service.js';
import type { ProviderHealthStatus } from '../health/ai-health-probe.service.js';
import { getAiPlatformConfig } from '../config/ai.config.js';

export type AiAlertType =
  | 'budget_exceeded'
  | 'provider_unavailable'
  | 'usage_spike';

const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

export class AiUsageAlertService {
  readonly name = 'AiUsageAlertService';

  private shouldEmit(alertType: AiAlertType, key: string): boolean {
    const composite = `${alertType}:${key}`;
    const now = Date.now();
    const last = lastAlertAt.get(composite) ?? 0;
    if (now - last < ALERT_COOLDOWN_MS) return false;
    lastAlertAt.set(composite, now);
    return true;
  }

  private async persistAlert(params: {
    alertType: AiAlertType;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await getPrisma().aiUsageAlert.create({
        data: {
          alertType: params.alertType,
          severity: params.severity,
          message: params.message,
          ...(params.metadata !== undefined ? { metadataJson: params.metadata as never } : {}),
        },
      });
    } catch (err) {
      getLogger().error({ err, alertType: params.alertType }, 'Failed to persist AI usage alert');
    }
  }

  async emitBudgetExceeded(status: AiBudgetStatus): Promise<void> {
    if (!this.shouldEmit('budget_exceeded', 'platform')) return;

    const parts: string[] = [];
    if (status.daily.exceeded) {
      parts.push(`daily $${status.daily.spentUsd.toFixed(4)} / $${status.daily.budgetUsd}`);
    }
    if (status.monthly.exceeded) {
      parts.push(`monthly $${status.monthly.spentUsd.toFixed(4)} / $${status.monthly.budgetUsd}`);
    }

    const message = `AI budget exceeded: ${parts.join('; ')}`;
    logAiPlatformEvent('alert_budget_exceeded', { status });
    await this.persistAlert({
      alertType: 'budget_exceeded',
      severity: 'critical',
      message,
      metadata: status as unknown as Record<string, unknown>,
    });
  }

  async emitProviderUnavailable(status: ProviderHealthStatus): Promise<void> {
    if (!status.configured || status.reachable) return;
    if (!this.shouldEmit('provider_unavailable', status.provider)) return;

    const message = `AI provider ${status.provider} unavailable (${status.errorCode ?? 'unknown'})`;
    logAiPlatformEvent('alert_provider_unavailable', { provider: status.provider, errorCode: status.errorCode });
    await this.persistAlert({
      alertType: 'provider_unavailable',
      severity: 'warning',
      message,
      metadata: status as unknown as Record<string, unknown>,
    });
  }

  async checkUsageSpike(recentHourRequests: number, baselineHourRequests: number): Promise<void> {
    const config = getAiPlatformConfig();
    if (baselineHourRequests <= 0) return;

    const ratio = recentHourRequests / baselineHourRequests;
    if (ratio < config.usageSpikeMultiplier) return;
    if (!this.shouldEmit('usage_spike', 'platform')) return;

    const message = `Unusual AI usage spike: ${recentHourRequests} requests in last hour (${ratio.toFixed(1)}x baseline)`;
    logAiPlatformEvent('alert_usage_spike', { recentHourRequests, baselineHourRequests, ratio });
    await this.persistAlert({
      alertType: 'usage_spike',
      severity: 'warning',
      message,
      metadata: { recentHourRequests, baselineHourRequests, ratio },
    });
  }

  async listRecent(limit = 50, unacknowledgedOnly = false) {
    return getPrisma().aiUsageAlert.findMany({
      ...(unacknowledgedOnly ? { where: { acknowledged: false } } : {}),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

let service: AiUsageAlertService | null = null;

export function getAiUsageAlertService(): AiUsageAlertService {
  if (!service) service = new AiUsageAlertService();
  return service;
}

export function resetAiUsageAlertServiceForTests(): void {
  lastAlertAt.clear();
  service = null;
}
