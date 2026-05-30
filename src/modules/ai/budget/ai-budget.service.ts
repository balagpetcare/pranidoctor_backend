import { getPrisma } from '../../../shared/database/prisma.js';
import { getLogger } from '../../../shared/logger/logger.js';
import { logAiExecution, logAiPlatformEvent } from '../../../shared/monitoring/structured-logging.js';
import { getAiPlatformConfig } from '../config/ai.config.js';
import { getAiUsageAlertService } from '../alerts/ai-usage-alert.service.js';

function utcDayStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcMonthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

export type AiBudgetStatus = {
  daily: {
    budgetUsd: number | null;
    spentUsd: number;
    remainingUsd: number | null;
    exceeded: boolean;
  };
  monthly: {
    budgetUsd: number | null;
    spentUsd: number;
    remainingUsd: number | null;
    exceeded: boolean;
  };
  blocked: boolean;
};

export class AiBudgetService {
  readonly name = 'AiBudgetService';

  private dailyBlocked = false;
  private monthlyBlocked = false;

  async getSpendSince(since: Date): Promise<number> {
    const agg = await getPrisma().aiUsageDailyRollup.aggregate({
      where: { bucketDate: { gte: since } },
      _sum: { billableCostUsd: true },
    });
    return decimalToNumber(agg._sum.billableCostUsd);
  }

  async getStatus(): Promise<AiBudgetStatus> {
    const config = getAiPlatformConfig();
    const dailySpent = await this.getSpendSince(utcDayStart());
    const monthlySpent = await this.getSpendSince(utcMonthStart());

    const dailyExceeded =
      config.dailyBudgetUsd != null && dailySpent >= config.dailyBudgetUsd;
    const monthlyExceeded =
      config.monthlyBudgetUsd != null && monthlySpent >= config.monthlyBudgetUsd;

    this.dailyBlocked = dailyExceeded;
    this.monthlyBlocked = monthlyExceeded;

    return {
      daily: {
        budgetUsd: config.dailyBudgetUsd,
        spentUsd: Math.round(dailySpent * 1_000_000) / 1_000_000,
        remainingUsd:
          config.dailyBudgetUsd != null
            ? Math.max(0, config.dailyBudgetUsd - dailySpent)
            : null,
        exceeded: dailyExceeded,
      },
      monthly: {
        budgetUsd: config.monthlyBudgetUsd,
        spentUsd: Math.round(monthlySpent * 1_000_000) / 1_000_000,
        remainingUsd:
          config.monthlyBudgetUsd != null
            ? Math.max(0, config.monthlyBudgetUsd - monthlySpent)
            : null,
        exceeded: monthlyExceeded,
      },
      blocked: dailyExceeded || monthlyExceeded,
    };
  }

  async assertBudgetAllowsLlm(): Promise<void> {
    const status = await this.getStatus();
    if (!status.blocked) return;

    logAiPlatformEvent('budget_blocked', {
      dailyExceeded: status.daily.exceeded,
      monthlyExceeded: status.monthly.exceeded,
      dailySpent: status.daily.spentUsd,
      monthlySpent: status.monthly.spentUsd,
    });

    await getAiUsageAlertService().emitBudgetExceeded(status);
  }

  /** Called after each billable attempt to detect budget threshold crossings. */
  async checkBudgetAfterUsage(): Promise<void> {
    const config = getAiPlatformConfig();
    if (config.dailyBudgetUsd == null && config.monthlyBudgetUsd == null) return;

    const prevDaily = this.dailyBlocked;
    const prevMonthly = this.monthlyBlocked;
    const status = await this.getStatus();

    if (!prevDaily && status.daily.exceeded) {
      getLogger().warn({ spentUsd: status.daily.spentUsd }, 'Daily AI budget exceeded');
      await getAiUsageAlertService().emitBudgetExceeded(status);
    }
    if (!prevMonthly && status.monthly.exceeded) {
      getLogger().warn({ spentUsd: status.monthly.spentUsd }, 'Monthly AI budget exceeded');
      await getAiUsageAlertService().emitBudgetExceeded(status);
    }
  }

  isBudgetBlocked(): boolean {
    return this.dailyBlocked || this.monthlyBlocked;
  }

  resetForTests(): void {
    this.dailyBlocked = false;
    this.monthlyBlocked = false;
  }
}

let service: AiBudgetService | null = null;

export function getAiBudgetService(): AiBudgetService {
  if (!service) service = new AiBudgetService();
  return service;
}
