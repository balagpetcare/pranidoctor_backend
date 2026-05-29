import {
  AiAlertPriority,
  AiAlertStatus,
  SmartRecommendationStatus,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getSmartRecommendationService } from '../recommendations/smart-recommendation.service.js';

export class NotificationIntelligenceService {
  readonly name = 'NotificationIntelligenceService';

  async syncAlertsFromRecommendations(customerId: string, userId?: string) {
    const prisma = getPrisma();
    await getSmartRecommendationService().generateForCustomer(customerId);

    const pending = await prisma.smartRecommendation.findMany({
      where: { customerId, status: SmartRecommendationStatus.PENDING, priority: { lte: 2 } },
      take: 20,
    });

    for (const rec of pending) {
      const existing = await prisma.aiSmartAlert.findFirst({
        where: {
          customerId,
          type: `rec:${rec.id}`,
          status: { in: [AiAlertStatus.PENDING, AiAlertStatus.DELIVERED] },
        },
      });
      if (existing) continue;

      await prisma.aiSmartAlert.create({
        data: {
          customerId,
          userId,
          type: `rec:${rec.id}`,
          priority: rec.priority === 1 ? AiAlertPriority.HIGH : AiAlertPriority.MEDIUM,
          titleBn: rec.titleBn,
          titleEn: rec.titleEn,
          bodyBn: rec.explanationBn,
          bodyEn: rec.explanationEn,
          deepLink: rec.deepLink,
          status: AiAlertStatus.PENDING,
          scheduledAt: new Date(),
        },
      });
    }
  }

  async listAlerts(customerId: string, locale: 'bn' | 'en' = 'bn') {
    const prisma = getPrisma();
    const rows = await prisma.aiSmartAlert.findMany({
      where: {
        customerId,
        status: { in: [AiAlertStatus.PENDING, AiAlertStatus.DELIVERED] },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      priority: r.priority,
      title: locale === 'bn' ? r.titleBn : r.titleEn,
      body: locale === 'bn' ? r.bodyBn : r.bodyEn,
      deepLink: r.deepLink,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async markDelivered(customerId: string, alertId: string) {
    const prisma = getPrisma();
    await prisma.aiSmartAlert.updateMany({
      where: { id: alertId, customerId },
      data: { status: AiAlertStatus.DELIVERED, deliveredAt: new Date() },
    });
  }

  async dismissAlert(customerId: string, alertId: string) {
    const prisma = getPrisma();
    await prisma.aiSmartAlert.updateMany({
      where: { id: alertId, customerId },
      data: { status: AiAlertStatus.DISMISSED },
    });
  }
}

let service: NotificationIntelligenceService | null = null;

export function getNotificationIntelligenceService(): NotificationIntelligenceService {
  if (!service) service = new NotificationIntelligenceService();
  return service;
}
