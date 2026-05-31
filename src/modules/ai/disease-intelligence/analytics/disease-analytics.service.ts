import type { DiAnalyticsEventType, LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';

export class DiseaseAnalyticsService {
  readonly name = 'DiseaseAnalyticsService';

  async track(
    eventType: DiAnalyticsEventType,
    params?: { caseId?: string; registryId?: string; metadata?: unknown },
  ) {
    return getDiseaseIntelligenceRepository().ingestAnalyticsEvent(
      omitUndefined({
        eventType,
        caseId: params?.caseId,
        registryId: params?.registryId,
        metadata: params?.metadata,
      }),
    );
  }

  async recordCorpusGap(params: { queryText: string; locale: string; species?: LivestockSpecies }) {
    return getDiseaseIntelligenceRepository().createCorpusGapTicket(params);
  }

  async getOverview() {
    const prisma = getPrisma();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [registryCount, caseCount, blocks, gaps, differentials] = await Promise.all([
      prisma.diDiseaseRegistry.count({ where: { status: 'ACTIVE' } }),
      prisma.diCaseSession.count({ where: { createdAt: { gte: since } } }),
      prisma.diAnalyticsEvent.count({
        where: { eventType: 'SAFETY_BLOCK', createdAt: { gte: since } },
      }),
      prisma.diCorpusGapTicket.count({ where: { status: 'OPEN' } }),
      prisma.diDifferentialRun.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
      activeDiseases: registryCount,
      casesLast30Days: caseCount,
      safetyBlocksLast30Days: blocks,
      openCorpusGaps: gaps,
      differentialRunsLast30Days: differentials,
    };
  }

  async listCorpusGaps(take = 50) {
    const prisma = getPrisma();
    return prisma.diCorpusGapTicket.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}

let service: DiseaseAnalyticsService | undefined;

export function getDiseaseAnalyticsService(): DiseaseAnalyticsService {
  service ??= new DiseaseAnalyticsService();
  return service;
}
