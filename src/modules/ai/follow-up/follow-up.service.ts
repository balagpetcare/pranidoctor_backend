import { getPrisma } from '../../../shared/database/prisma.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

export class FollowUpService {
  readonly name = 'FollowUpService';

  async createFromSymptomCheck(params: {
    userId: string;
    customerId?: string;
    livestockId?: string;
    sessionId?: string;
    triageBucket: string;
    locale?: 'bn' | 'en';
  }) {
    const prisma = getPrisma();
    const locale = params.locale ?? 'bn';

    const suggestions: Array<{
      titleBn: string;
      titleEn: string;
      actionBn: string;
      actionEn: string;
      dueDate: Date | null;
      deepLink: string | null;
    }> = [];

    if (params.triageBucket === 'HIGH') {
      suggestions.push({
        titleBn: 'জরুরি — চিকিৎসকের সাথে যোগাযোগ',
        titleEn: 'Urgent — contact a veterinarian',
        actionBn: 'আজই চিকিৎসক বুক করুন বা জরুরি সেবা নিন।',
        actionEn: 'Book a vet today or request emergency service.',
        dueDate: new Date(),
        deepLink: '/services',
      });
    } else if (params.triageBucket === 'MEDIUM') {
      const due = new Date();
      due.setDate(due.getDate() + 2);
      suggestions.push({
        titleBn: 'লক্ষণ পর্যবেক্ষণ',
        titleEn: 'Monitor symptoms',
        actionBn: '৪৮ ঘণ্টা পর্যবেক্ষণ করুন; অবনতি হলে চিকিৎসক দেখান।',
        actionEn: 'Monitor for 48 hours; see a vet if worsening.',
        dueDate: due,
        deepLink: params.livestockId ? `/livestock/${params.livestockId}` : '/ai',
      });
    } else {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      suggestions.push({
        titleBn: 'নিয়মিত পর্যবেক্ষণ',
        titleEn: 'Routine monitoring',
        actionBn: 'পশুর appetite ও সক্রিয়তা লক্ষ্য রাখুন।',
        actionEn: 'Watch appetite and activity levels.',
        dueDate: due,
        deepLink: params.livestockId ? `/livestock/${params.livestockId}` : '/ai',
      });
    }

    const created = [];
    for (const s of suggestions) {
      const row = await prisma.aiFollowUpSuggestion.create({
        data: omitUndefined({
          userId: params.userId,
          customerId: params.customerId,
          livestockId: params.livestockId,
          sessionId: params.sessionId,
          ...s,
        }),
      });
      created.push({
        id: row.id,
        title: locale === 'bn' ? row.titleBn : row.titleEn,
        action: locale === 'bn' ? row.actionBn : row.actionEn,
        dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
        deepLink: row.deepLink,
      });
    }
    return created;
  }

  async listForUser(userId: string, locale: 'bn' | 'en' = 'bn') {
    const prisma = getPrisma();
    const rows = await prisma.aiFollowUpSuggestion.findMany({
      where: { userId, dismissed: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      title: locale === 'bn' ? r.titleBn : r.titleEn,
      action: locale === 'bn' ? r.actionBn : r.actionEn,
      dueDate: r.dueDate?.toISOString().slice(0, 10) ?? null,
      deepLink: r.deepLink,
    }));
  }

  async dismiss(userId: string, id: string) {
    const prisma = getPrisma();
    await prisma.aiFollowUpSuggestion.updateMany({
      where: { id, userId },
      data: { dismissed: true },
    });
  }
}

let service: FollowUpService | null = null;

export function getFollowUpService(): FollowUpService {
  if (!service) service = new FollowUpService();
  return service;
}
