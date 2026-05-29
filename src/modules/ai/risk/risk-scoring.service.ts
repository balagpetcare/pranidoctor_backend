import { getPrisma } from '../../../shared/database/prisma.js';

export class RiskScoringService {
  readonly name = 'RiskScoringService';

  async computeFarmRisk(customerId: string, farmRef: string) {
    const prisma = getPrisma();

    const livestock = await prisma.livestock.findMany({
      where: { customerId, farmRef, deletedAt: null, lifecycleStatus: 'ACTIVE' },
      include: {
        healthRecords: { orderBy: { recordedDate: 'desc' }, take: 3 },
        vaccinations: true,
      },
    });

    if (livestock.length === 0) {
      return {
        herdHealthScore: 100,
        farmRiskScore: 10,
        mortalityRiskAvg: 0,
        factors: [{ factor: 'no_livestock', impact: 0 }],
      };
    }

    let healthSum = 0;
    let mortalitySum = 0;
    const factors: Array<{ factor: string; impact: number; detail?: string }> = [];

    for (const animal of livestock) {
      let animalHealth = 100;
      let mortalityRisk = 5;

      if (animal.healthStatus === 'SICK') {
        animalHealth -= 30;
        mortalityRisk += 25;
        factors.push({ factor: 'sick_animal', impact: 30, detail: animal.name });
      } else if (animal.healthStatus === 'RECOVERING') {
        animalHealth -= 15;
        mortalityRisk += 10;
      }

      const recentIllness = animal.healthRecords.some(
        (h) => h.recordType === 'ILLNESS' || h.recordType === 'DISEASE',
      );
      if (recentIllness) {
        animalHealth -= 10;
        mortalityRisk += 8;
      }

      const overdueVaccines = animal.vaccinations.filter(
        (v) => v.status === 'SCHEDULED' && v.scheduledDate < new Date(),
      ).length;
      if (overdueVaccines > 0) {
        animalHealth -= overdueVaccines * 8;
        mortalityRisk += overdueVaccines * 5;
        factors.push({ factor: 'overdue_vaccine', impact: overdueVaccines * 8, detail: animal.name });
      }

      if (animal.weightKg != null && Number(animal.weightKg) < 50 && animal.species === 'CATTLE') {
        mortalityRisk += 5;
      }

      healthSum += Math.max(0, animalHealth);
      mortalitySum += Math.min(100, mortalityRisk);
    }

    const herdHealthScore = Math.round(healthSum / livestock.length);
    const mortalityRiskAvg = Math.round((mortalitySum / livestock.length) * 10) / 10;

    const outbreak = await prisma.regionalOutbreakSignal.findFirst({
      where: { effectiveDate: { lte: new Date() } },
      orderBy: { effectiveDate: 'desc' },
    });
    let outbreakPenalty = 0;
    if (outbreak && outbreak.riskIndex > 50) {
      outbreakPenalty = Math.round(outbreak.riskIndex * 0.2);
      factors.push({ factor: 'regional_outbreak', impact: outbreakPenalty, detail: outbreak.diseaseSlug });
    }

    const farmRiskScore = Math.min(
      100,
      Math.max(0, 100 - herdHealthScore + outbreakPenalty + Math.round(mortalityRiskAvg * 0.3)),
    );

    const snapshot = await prisma.farmRiskSnapshot.create({
      data: {
        customerId,
        farmRef,
        herdHealthScore,
        farmRiskScore,
        mortalityRiskAvg,
        factorsJson: factors,
      },
    });

    return {
      snapshotId: snapshot.id,
      herdHealthScore,
      farmRiskScore,
      mortalityRiskAvg,
      factors,
      computedAt: snapshot.computedAt.toISOString(),
    };
  }

  async getLatestSnapshot(customerId: string, farmRef: string) {
    const prisma = getPrisma();
    return prisma.farmRiskSnapshot.findFirst({
      where: { customerId, farmRef },
      orderBy: { computedAt: 'desc' },
    });
  }
}

let service: RiskScoringService | null = null;

export function getRiskScoringService(): RiskScoringService {
  if (!service) service = new RiskScoringService();
  return service;
}
