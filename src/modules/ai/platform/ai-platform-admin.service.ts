import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiUsageService } from '../usage/ai-usage.service.js';
import { getAiBudgetService } from '../budget/ai-budget.service.js';
import {
  getLatestProviderHealth,
  runAiProviderHealthProbes,
} from '../health/ai-health-probe.service.js';
import { getAiUsageAlertService } from '../alerts/ai-usage-alert.service.js';
import { validateAllLlmProviders } from '../orchestrator/providers/provider.validation.js';

function utcMonthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

export class AiPlatformAdminService {
  readonly name = 'AiPlatformAdminService';

  async getUsageDashboard(sinceDays = 30) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const summary = await getAiUsageService().getUsageSummary(since);
    const daily = await getAiUsageService().getDailyCostAggregation(since);
    const budget = await getAiBudgetService().getStatus();
    const alerts = await getAiUsageAlertService().listRecent(20, true);

    return {
      since: since.toISOString(),
      summary,
      daily,
      budget,
      alerts,
    };
  }

  async getCostsDashboard(sinceDays = 30) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);

    const [daily, monthly, budget] = await Promise.all([
      getAiUsageService().getDailyCostAggregation(since),
      getAiUsageService().getMonthlyCostAggregation(utcMonthStart(new Date(Date.now() - sinceDays * 86400000))),
      getAiBudgetService().getStatus(),
    ]);

    return { since: since.toISOString(), daily, monthly, budget };
  }

  async getProvidersDashboard() {
    const validations = validateAllLlmProviders();
    let health = getLatestProviderHealth();

    if (health.every((h) => h.lastProbedAt === new Date(0).toISOString())) {
      health = await runAiProviderHealthProbes({ persist: false, skipNetwork: process.env.NODE_ENV === 'test' });
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const metrics = await getAiUsageService().getProviderMetrics(since);

    for (const h of health) {
      if (h.configured && !h.reachable) {
        void getAiUsageAlertService().emitProviderUnavailable(h);
      }
    }

    return { validations, health, metrics };
  }

  async getHealthDashboard() {
    const validations = validateAllLlmProviders();
    const health = await runAiProviderHealthProbes({
      persist: process.env.NODE_ENV !== 'test',
      skipNetwork: process.env.NODE_ENV === 'test',
    });
    const budget = await getAiBudgetService().getStatus();
    const recentSnapshots = await getPrisma().aiProviderHealthSnapshot.findMany({
      orderBy: { probedAt: 'desc' },
      take: 20,
    });

    return {
      validations,
      providers: health,
      budget,
      recentSnapshots: recentSnapshots.map((s) => ({
        provider: s.provider,
        reachable: s.reachable,
        latencyMs: s.latencyMs,
        errorCode: s.errorCode,
        probedAt: s.probedAt.toISOString(),
      })),
    };
  }
}

let service: AiPlatformAdminService | null = null;

export function getAiPlatformAdminService(): AiPlatformAdminService {
  if (!service) service = new AiPlatformAdminService();
  return service;
}
