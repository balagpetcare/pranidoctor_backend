import {
  getTechnicianModuleReviewBundle,
  mergeLegacyAndModuleRating,
} from "@/lib/mobile-ai-services/ai-quality-service";
import {
  AiServiceRequestStatus,
  AiTechnicianServiceStatus,
  AiTechnicianStatus,
  Prisma,
  ReviewStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  getTechnicianProfileForUser,
  serializeTechnicianProfile,
} from "./application-service";

function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getMobileTechnicianDashboard(userId: string) {
  const profile = await getTechnicianProfileForUser(userId);
  if (!profile) {
    return {
      profile: null,
      profileStatus: null as AiTechnicianStatus | null,
      isPublished: false,
      providerStatus: null as string | null,
      acceptsEmergency: false,
      todayRequestsCount: 0,
      pendingRequestsCount: 0,
      completedServicesCount: 0,
      totalEarningsBdt: "0",
      ratingAverage: null as number | null,
      ratingCount: 0,
      recentReviews: [] as { id: string; rating: number; comment: string | null; createdAt: string }[],
      activeServices: [] as ReturnType<typeof serializeTechnicianServiceSummary>[],
      adminNote: null as string | null,
      correctionNote: null as string | null,
    };
  }

  const now = new Date();
  const dayStart = utcStartOfDay(now);
  const dayEnd = new Date(dayStart.getTime() + 86400_000);

  const technicianProfileId = profile.id;

  const [
    todayRequestsCount,
    pendingRequestsCount,
    completedServicesCount,
    earningsAgg,
    activeServicesRows,
  ] = await prisma.$transaction([
    prisma.aiServiceRequest.count({
      where: {
        technicianProfileId,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    }),
    prisma.aiServiceRequest.count({
      where: {
        technicianProfileId,
        status: {
          in: [
            AiServiceRequestStatus.PENDING,
            AiServiceRequestStatus.ACCEPTED,
            AiServiceRequestStatus.ON_THE_WAY,
            AiServiceRequestStatus.ARRIVED,
            AiServiceRequestStatus.IN_PROGRESS,
          ],
        },
      },
    }),
    prisma.aiServiceRequest.count({
      where: {
        technicianProfileId,
        status: AiServiceRequestStatus.COMPLETED,
      },
    }),
    prisma.aiServiceRequest.aggregate({
      where: {
        technicianProfileId,
        status: AiServiceRequestStatus.COMPLETED,
        finalFee: { not: null },
      },
      _sum: { finalFee: true },
    }),
    prisma.aiTechnicianService.findMany({
      where: {
        aiTechnicianId: technicianProfileId,
        status: AiTechnicianServiceStatus.ACTIVE,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const totalEarnings = earningsAgg._sum.finalFee;
  const totalEarningsBdt =
    totalEarnings == null
      ? "0"
      : typeof (totalEarnings as { toString?: () => string }).toString ===
          "function"
        ? (totalEarnings as { toString: () => string }).toString()
        : String(totalEarnings);

  const [legacyAgg, moduleBundle] = await Promise.all([
    prisma.review.aggregate({
      where: {
        aiTechnicianId: technicianProfileId,
        status: ReviewStatus.APPROVED,
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    getTechnicianModuleReviewBundle(technicianProfileId),
  ]);

  const merged = mergeLegacyAndModuleRating(
    legacyAgg._count._all > 0
      ? {
          avg: legacyAgg._avg.rating ?? 0,
          count: legacyAgg._count._all,
        }
      : undefined,
    moduleBundle.ratingCount > 0 && moduleBundle.ratingAverage != null
      ? {
          avg: moduleBundle.ratingAverage,
          count: moduleBundle.ratingCount,
        }
      : undefined,
  );

  return {
    profile: serializeTechnicianProfile(profile),
    profileStatus: profile.status,
    isPublished: profile.status === AiTechnicianStatus.PUBLISHED,
    providerStatus: profile.providerStatus,
    acceptsEmergency: profile.acceptsEmergency,
    todayRequestsCount,
    pendingRequestsCount,
    completedServicesCount,
    totalEarningsBdt,
    ratingAverage: merged.count > 0 ? merged.avg : null,
    ratingCount: merged.count,
    recentReviews: moduleBundle.recentReviews,
    activeServices: activeServicesRows.map(serializeTechnicianServiceSummary),
    adminNote: profile.adminNote,
    correctionNote: profile.correctionNote,
  };
}

export function serializeTechnicianServiceSummary(
  row: Prisma.AiTechnicianServiceGetPayload<Record<string, never>>,
) {
  return {
    id: row.id,
    title: row.title,
    animalType: row.animalType,
    breedOrSemenType: row.breedOrSemenType,
    basePrice: row.basePrice.toString(),
    visitFee: row.visitFee?.toString() ?? null,
    emergencyFee: row.emergencyFee?.toString() ?? null,
    followUpIncluded: row.followUpIncluded,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
