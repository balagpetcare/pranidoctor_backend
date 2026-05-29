import { LivestockLifecycleStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

export type PlatformLivestockStats = {
  totals: {
    all: number;
    active: number;
    archived: number;
  };
  bySpecies: Array<{ species: string; count: number }>;
  byPurpose: Array<{ purpose: string; count: number }>;
  byHealthStatus: Array<{ healthStatus: string; count: number }>;
  healthRecordsLast30Days: number;
  vaccinationsPending: number;
  recentRegistrations: Array<{ date: string; count: number }>;
};

export async function adminGetPlatformLivestockStats(): Promise<PlatformLivestockStats> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  since.setUTCHours(0, 0, 0, 0);

  const [
    totalAll,
    totalActive,
    speciesGroups,
    purposeGroups,
    healthGroups,
    healthRecordsCount,
    vaccinationsPending,
    recentByDay,
  ] = await Promise.all([
    prisma.livestock.count(),
    prisma.livestock.count({ where: { lifecycleStatus: LivestockLifecycleStatus.ACTIVE } }),
    prisma.livestock.groupBy({
      by: ['species'],
      _count: { _all: true },
      where: { lifecycleStatus: LivestockLifecycleStatus.ACTIVE },
    }),
    prisma.livestock.groupBy({
      by: ['purpose'],
      _count: { _all: true },
      where: { lifecycleStatus: LivestockLifecycleStatus.ACTIVE },
    }),
    prisma.livestock.groupBy({
      by: ['healthStatus'],
      _count: { _all: true },
      where: { lifecycleStatus: LivestockLifecycleStatus.ACTIVE },
    }),
    prisma.livestockHealthRecord.count({
      where: { recordedDate: { gte: since } },
    }),
    prisma.livestockVaccination.count({
      where: { status: 'SCHEDULED', scheduledDate: { lte: new Date() } },
    }),
    prisma.livestock.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const recentRegistrationsMap = new Map<string, number>();
  for (const row of recentByDay) {
    const date = row.createdAt.toISOString().slice(0, 10);
    recentRegistrationsMap.set(date, (recentRegistrationsMap.get(date) ?? 0) + 1);
  }

  return {
    totals: {
      all: totalAll,
      active: totalActive,
      archived: totalAll - totalActive,
    },
    bySpecies: speciesGroups.map((g) => ({
      species: g.species,
      count: g._count._all,
    })),
    byPurpose: purposeGroups
      .filter((g) => g.purpose != null)
      .map((g) => ({
        purpose: g.purpose!,
        count: g._count._all,
      })),
    byHealthStatus: healthGroups.map((g) => ({
      healthStatus: g.healthStatus,
      count: g._count._all,
    })),
    healthRecordsLast30Days: healthRecordsCount,
    vaccinationsPending,
    recentRegistrations: [...recentRegistrationsMap.entries()].map(([date, count]) => ({
      date,
      count,
    })),
  };
}
