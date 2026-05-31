import { getPrisma } from '../../../shared/database/prisma.js';
import { withAiAdminDiagnostics } from '../admin/ai-admin-diagnostics.js';
import { getAiUsageService } from '../usage/ai-usage.service.js';

export class AiAnalyticsService {
  readonly name = 'AiAnalyticsService';

  async getOverview(sinceDays = 30) {
    return withAiAdminDiagnostics(
      {
        layer: 'service',
        route: 'GET /api/admin/ai-ops/overview',
        service: this.name,
        operation: 'getOverview',
        requestPayload: { sinceDays },
      },
      async () => {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const prisma = getPrisma();

    const usage = await getAiUsageService().getUsageSummary(since);

    const [chatSessions, triageCount, symptomChecks, escalations, recommendations] =
      await Promise.all([
        prisma.aiAssistantSession.count({ where: { createdAt: { gte: since } } }),
        prisma.aiTriageRecord.count({ where: { createdAt: { gte: since } } }),
        prisma.aiSymptomCheckSession.count({ where: { createdAt: { gte: since } } }),
        prisma.aiEscalationRecord.count({ where: { createdAt: { gte: since } } }),
        prisma.smartRecommendation.count({ where: { createdAt: { gte: since } } }),
      ]);

    const riskSnapshots = await prisma.farmRiskSnapshot.findMany({
      where: { computedAt: { gte: since } },
      orderBy: { computedAt: 'desc' },
      take: 100,
    });

    const avgHerdHealth =
      riskSnapshots.length > 0
        ? Math.round(
            riskSnapshots.reduce((s, r) => s + r.herdHealthScore, 0) / riskSnapshots.length,
          )
        : null;

    return {
      since: since.toISOString(),
      usage,
      sessions: { chat: chatSessions, triage: triageCount, symptomChecks },
      escalations,
      recommendations,
      avgHerdHealth,
      riskSnapshotCount: riskSnapshots.length,
    };
      },
    );
  }

  async getRiskMonitoring() {
    const prisma = getPrisma();
    const outbreaks = await prisma.regionalOutbreakSignal.findMany({
      orderBy: { effectiveDate: 'desc' },
      take: 20,
    });

    const highRiskFarms = await prisma.farmRiskSnapshot.findMany({
      where: { farmRiskScore: { gte: 60 } },
      orderBy: { computedAt: 'desc' },
      take: 50,
    });

    return { outbreaks, highRiskFarms };
  }
}

let service: AiAnalyticsService | null = null;

export function getAiAnalyticsService(): AiAnalyticsService {
  if (!service) service = new AiAnalyticsService();
  return service;
}
