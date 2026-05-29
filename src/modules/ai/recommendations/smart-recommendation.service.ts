import { addDays } from 'date-fns';

import {
  LivestockVaccinationStatus,
  SmartRecommendationStatus,
  SmartRecommendationType,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getFeedRecommendationService } from '../../feed-recommendation/feed-recommendation.service.js';

const DEWORM_INTERVAL_DAYS: Record<string, number> = {
  CATTLE: 90,
  BUFFALO: 90,
  GOAT: 60,
  SHEEP: 60,
  POULTRY: 45,
  DUCK: 45,
  OTHER: 90,
};

export class SmartRecommendationService {
  readonly name = 'SmartRecommendationService';
  readonly ruleVersion = 'smart-v1';

  async generateForCustomer(customerId: string, farmRef?: string, locale: 'bn' | 'en' = 'bn') {
    const prisma = getPrisma();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const livestock = await prisma.livestock.findMany({
      where: {
        customerId,
        deletedAt: null,
        lifecycleStatus: 'ACTIVE',
        ...(farmRef ? { farmRef } : {}),
      },
      include: {
        vaccinations: { orderBy: { scheduledDate: 'desc' }, take: 5 },
      },
    });

    const recommendations: Array<{
      customerId: string;
      farmRef: string | null;
      livestockId: string | null;
      type: SmartRecommendationType;
      priority: number;
      titleBn: string;
      titleEn: string;
      explanationBn: string;
      explanationEn: string;
      dueDate: Date | null;
      deepLink: string | null;
      confidence: number;
    }> = [];

    for (const animal of livestock) {
      const overdueVaccines = animal.vaccinations.filter(
        (v) =>
          v.status === LivestockVaccinationStatus.SCHEDULED &&
          v.scheduledDate < today,
      );
      for (const v of overdueVaccines) {
        recommendations.push({
          customerId,
          farmRef: animal.farmRef,
          livestockId: animal.id,
          type: SmartRecommendationType.VACCINE,
          priority: 1,
          titleBn: `${animal.name}: ${v.vaccineName} টিকা বাকি`,
          titleEn: `${animal.name}: ${v.vaccineName} vaccine overdue`,
          explanationBn: 'নির্ধারিত তারিখ পেরিয়ে গেছে — টিকা দিন বা চিকিৎসকের পরামর্শ নিন।',
          explanationEn: 'Scheduled date passed — vaccinate or consult your vet.',
          dueDate: v.scheduledDate,
          deepLink: `/vaccine`,
          confidence: 0.95,
        });
      }

      const lastDeworm = await prisma.dewormingRecord.findFirst({
        where: { livestockId: animal.id },
        orderBy: { administeredDate: 'desc' },
      });
      const interval = DEWORM_INTERVAL_DAYS[animal.species] ?? 90;
      const nextDue = lastDeworm?.nextDueDate
        ? new Date(lastDeworm.nextDueDate)
        : addDays(today, -interval);
      if (!lastDeworm || nextDue <= today) {
        recommendations.push({
          customerId,
          farmRef: animal.farmRef,
          livestockId: animal.id,
          type: SmartRecommendationType.DEWORM,
          priority: 2,
          titleBn: `${animal.name}: কৃমিনাশক প্রয়োজন`,
          titleEn: `${animal.name}: Deworming due`,
          explanationBn: `প্রতি ${interval} দিনে কৃমিনাশক দেওয়ার পরামর্শ।`,
          explanationEn: `Deworming recommended every ${interval} days.`,
          dueDate: today,
          deepLink: `/livestock/${animal.id}`,
          confidence: 0.8,
        });
      }

      if (animal.pregnancyStatus === 'PREGNANT') {
        recommendations.push({
          customerId,
          farmRef: animal.farmRef,
          livestockId: animal.id,
          type: SmartRecommendationType.PREGNANCY,
          priority: 2,
          titleBn: `${animal.name}: গর্ভাবস্থার বিশেষ যত্ন`,
          titleEn: `${animal.name}: Pregnancy care`,
          explanationBn: 'পুষ্টিকর খাবার, পর্যাপ্ত বিশ্রাম ও নিয়মিত পর্যবেক্ষণ নিশ্চিত করুন।',
          explanationEn: 'Ensure nutritious feed, rest, and regular monitoring.',
          dueDate: null,
          deepLink: `/livestock/${animal.id}`,
          confidence: 0.85,
        });
      }

      try {
        const feedRec = await getFeedRecommendationService().getDailyRecommendation(
          customerId,
          animal.id,
        );
        if (feedRec?.items?.length) {
          recommendations.push({
            customerId,
            farmRef: animal.farmRef,
            livestockId: animal.id,
            type: SmartRecommendationType.FEED,
            priority: 3,
            titleBn: `${animal.name}: আজকের খাদ্য পরামর্শ`,
            titleEn: `${animal.name}: Today's feed plan`,
            explanationBn: feedRec.warnings?.[0] ?? 'দৈনিক খাদ্য পরিকল্পনা দেখুন।',
            explanationEn: feedRec.warnings?.[0] ?? 'Review daily feed plan.',
            dueDate: today,
            deepLink: `/feed-recommendations/${animal.id}`,
            confidence: 0.75,
          });
        }
      } catch {
        // skip feed rec if unavailable
      }
    }

    const lowStock = await prisma.feedInventory.findMany({
      where: {
        customerId,
        ...(farmRef ? { farmRef } : {}),
        isActive: true,
        deletedAt: null,
      },
      take: 20,
    });
    for (const inv of lowStock) {
      const threshold = inv.lowStockThreshold != null ? Number(inv.lowStockThreshold) : 10;
      if (Number(inv.quantityOnHand) > threshold) continue;
      recommendations.push({
        customerId,
        farmRef: inv.farmRef,
        livestockId: null,
        type: SmartRecommendationType.INVENTORY,
        priority: 2,
        titleBn: `খাদ্য স্টক কম: ${inv.displayName}`,
        titleEn: `Low feed stock: ${inv.displayName}`,
        explanationBn: 'শীঘ্রই খাদ্য কিনুন বা স্টক আপডেট করুন।',
        explanationEn: 'Purchase feed or update inventory soon.',
        dueDate: today,
        deepLink: '/inventory',
        confidence: 0.9,
      });
    }

    recommendations.sort((a, b) => a.priority - b.priority);

    await prisma.smartRecommendation.deleteMany({
      where: {
        customerId,
        status: SmartRecommendationStatus.PENDING,
        ...(farmRef ? { farmRef } : {}),
      },
    });

    if (recommendations.length > 0) {
      await prisma.smartRecommendation.createMany({
        data: recommendations.map((r) => ({
          ...r,
          ruleVersion: this.ruleVersion,
          status: SmartRecommendationStatus.PENDING,
        })),
      });
    }

    const stored = await prisma.smartRecommendation.findMany({
      where: {
        customerId,
        status: SmartRecommendationStatus.PENDING,
        ...(farmRef ? { farmRef } : {}),
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 50,
    });

    return stored.map((r) => ({
      id: r.id,
      type: r.type,
      priority: r.priority,
      title: locale === 'bn' ? r.titleBn : r.titleEn,
      explanation: locale === 'bn' ? r.explanationBn : r.explanationEn,
      dueDate: r.dueDate?.toISOString().slice(0, 10) ?? null,
      deepLink: r.deepLink,
      confidence: r.confidence,
      livestockId: r.livestockId,
      farmRef: r.farmRef,
    }));
  }

  async dismiss(customerId: string, id: string): Promise<boolean> {
    const prisma = getPrisma();
    const result = await prisma.smartRecommendation.updateMany({
      where: { id, customerId },
      data: { status: SmartRecommendationStatus.DISMISSED },
    });
    return result.count > 0;
  }

  async complete(customerId: string, id: string): Promise<boolean> {
    const prisma = getPrisma();
    const result = await prisma.smartRecommendation.updateMany({
      where: { id, customerId },
      data: { status: SmartRecommendationStatus.COMPLETED },
    });
    return result.count > 0;
  }
}

let service: SmartRecommendationService | null = null;

export function getSmartRecommendationService(): SmartRecommendationService {
  if (!service) service = new SmartRecommendationService();
  return service;
}
