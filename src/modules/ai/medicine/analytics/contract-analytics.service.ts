import { getPrisma } from '../../../../shared/database/prisma.js';
import type { MedicineContractType, MedicineContractStatus } from '../../../../generated/prisma/index.js';

export type ContractPerformanceMetrics = {
  contractId: string;
  contractCode: string;
  titleEn: string;
  contractType: MedicineContractType;
  status: MedicineContractStatus;
  totalImpressions: number;
  totalClicks: number;
  totalSelections: number;
  clickThroughRate: number;
  conversionRate: number;
  budgetUtilization: number;
  avgBoostScore: number;
  brandCount: number;
  topBrands: Array<{ brandId: string; brandCode: string; impressions: number }>;
};

export type ContractAnalyticsSummary = {
  totalContracts: number;
  activeContracts: number;
  totalBudgetBdt: number;
  totalSpentBdt: number;
  budgetUtilization: number;
  byType: Record<MedicineContractType, number>;
  byStatus: Record<MedicineContractStatus, number>;
  topPerformingContracts: Array<{ contractId: string; conversionRate: number }>;
};

export class ContractAnalyticsService {
  readonly name = 'ContractAnalyticsService';

  async getContractPerformance(contractId: string): Promise<ContractPerformanceMetrics | null> {
    const prisma = getPrisma();

    const contract = await prisma.medicineContract.findUnique({
      where: { id: contractId },
      include: {
        contractBrands: {
          include: { brand: { select: { brandCode: true } } },
        },
      },
    });

    if (!contract) return null;

    const brandIds = contract.contractBrands.map((cb) => cb.brandId);

    const logs = await prisma.medicineRecommendationLog.findMany({
      where: {
        winningBrandId: { in: brandIds },
      },
      take: 10000,
    });

    const impressions = logs.length;
    const clicks = logs.filter((l) => l.clickedAt).length;
    const selections = logs.filter((l) => l.selectedAt).length;

    const brandImpressions = new Map<string, number>();
    for (const log of logs) {
      if (log.winningBrandId) {
        brandImpressions.set(log.winningBrandId, (brandImpressions.get(log.winningBrandId) ?? 0) + 1);
      }
    }

    const topBrands = contract.contractBrands
      .map((cb) => ({
        brandId: cb.brandId,
        brandCode: cb.brand.brandCode,
        impressions: brandImpressions.get(cb.brandId) ?? 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    const avgBoostScore =
      contract.contractBrands.length > 0
        ? contract.contractBrands.reduce((sum, cb) => sum + Number(cb.boostScore), 0) /
          contract.contractBrands.length
        : 0;

    const budgetUtilization =
      contract.budgetBdt && Number(contract.budgetBdt) > 0
        ? Number(contract.spentBdt) / Number(contract.budgetBdt)
        : 0;

    return {
      contractId: contract.id,
      contractCode: contract.contractCode,
      titleEn: contract.titleEn,
      contractType: contract.contractType,
      status: contract.status,
      totalImpressions: impressions,
      totalClicks: clicks,
      totalSelections: selections,
      clickThroughRate: impressions > 0 ? clicks / impressions : 0,
      conversionRate: impressions > 0 ? selections / impressions : 0,
      budgetUtilization,
      avgBoostScore,
      brandCount: contract.contractBrands.length,
      topBrands,
    };
  }

  async getSummary(): Promise<ContractAnalyticsSummary> {
    const prisma = getPrisma();

    const contracts = await prisma.medicineContract.findMany({
      select: {
        id: true,
        contractType: true,
        status: true,
        budgetBdt: true,
        spentBdt: true,
      },
    });

    const totalContracts = contracts.length;
    const activeContracts = contracts.filter((c) => c.status === 'ACTIVE').length;

    let totalBudgetBdt = 0;
    let totalSpentBdt = 0;

    const byType: Record<MedicineContractType, number> = {
      SPONSOR: 0,
      CAMPAIGN: 0,
      ORGANIZATION: 0,
      REGIONAL: 0,
    };

    const byStatus: Record<MedicineContractStatus, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      PAUSED: 0,
      EXPIRED: 0,
      CANCELLED: 0,
    };

    for (const contract of contracts) {
      if (contract.budgetBdt) totalBudgetBdt += Number(contract.budgetBdt);
      totalSpentBdt += Number(contract.spentBdt);
      byType[contract.contractType]++;
      byStatus[contract.status]++;
    }

    return {
      totalContracts,
      activeContracts,
      totalBudgetBdt,
      totalSpentBdt,
      budgetUtilization: totalBudgetBdt > 0 ? totalSpentBdt / totalBudgetBdt : 0,
      byType,
      byStatus,
      topPerformingContracts: [],
    };
  }

  async getContractsBySponsor(companyId: string): Promise<Array<{
    contractId: string;
    contractCode: string;
    status: MedicineContractStatus;
    impressions: number;
    selections: number;
  }>> {
    const prisma = getPrisma();

    const contracts = await prisma.medicineContract.findMany({
      where: { sponsorCompanyId: companyId },
      include: {
        contractBrands: { select: { brandId: true } },
      },
    });

    const results = [];

    for (const contract of contracts) {
      const brandIds = contract.contractBrands.map((cb) => cb.brandId);

      const [impressions, selections] = await Promise.all([
        prisma.medicineRecommendationLog.count({
          where: { winningBrandId: { in: brandIds } },
        }),
        prisma.medicineRecommendationLog.count({
          where: {
            winningBrandId: { in: brandIds },
            selectedAt: { not: null },
          },
        }),
      ]);

      results.push({
        contractId: contract.id,
        contractCode: contract.contractCode,
        status: contract.status,
        impressions,
        selections,
      });
    }

    return results;
  }

  async getAuditTrailForContract(
    contractId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const prisma = getPrisma();

    const [events, total] = await Promise.all([
      prisma.medicineContractAudit.findMany({
        where: { contractId },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.medicineContractAudit.count({ where: { contractId } }),
    ]);

    return {
      items: events.map((e) => ({
        id: e.id,
        contractId: e.contractId,
        eventType: e.eventType,
        actorId: e.actorId,
        previousStateJson: e.previousStateJson,
        newStateJson: e.newStateJson,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
    };
  }
}

let service: ContractAnalyticsService | null = null;

export function getContractAnalyticsService(): ContractAnalyticsService {
  if (!service) service = new ContractAnalyticsService();
  return service;
}

export function resetContractAnalyticsServiceForTests(): void {
  service = null;
}
