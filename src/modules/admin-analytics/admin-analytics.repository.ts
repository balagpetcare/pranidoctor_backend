import {
  AnimalType,
  AreaType,
  ProviderStatus,
  ReviewStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  SessionStatus,
  UserStatus,
} from '../../generated/prisma/index.js';
import { Prisma } from '../../generated/prisma/index.js';
import { prisma } from '../../legacy/web/lib/prisma.js';
import {
  CONSULTATION_SERVICE_TYPES,
  DEFAULT_ACTIVE_USER_DAYS,
  REVENUE_BILLING_STATUSES,
} from './admin-analytics.constants.js';
import type { ResolvedDateRange } from './admin-analytics.date-range.js';

const consultationFilter = {
  serviceType: { in: CONSULTATION_SERVICE_TYPES },
};

function emergencyWhere() {
  return {
    OR: [
      { isEmergency: true },
      { serviceType: ServiceRequestType.EMERGENCY_DOCTOR },
    ],
  };
}

export class AdminAnalyticsRepository {
  countUsers() {
    return prisma.user.count({ where: { status: { not: UserStatus.DELETED } } });
  }

  countUsersCreatedBetween(from: Date, to: Date) {
    return prisma.user.count({
      where: { createdAt: { gte: from, lte: to }, status: { not: UserStatus.DELETED } },
    });
  }

  async countActiveUsers(since: Date): Promise<number> {
    const [devices, sessions] = await Promise.all([
      prisma.userDevice.findMany({
        where: { lastActiveAt: { gte: since }, revokedAt: null },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.userSession.findMany({
        where: { lastSeenAt: { gte: since }, status: SessionStatus.ACTIVE },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);
    const ids = new Set<string>();
    for (const d of devices) ids.add(d.userId);
    for (const s of sessions) ids.add(s.userId);
    return ids.size;
  }

  countFarmers() {
    return prisma.customerProfile.count();
  }

  countFarmersCreatedBetween(from: Date, to: Date) {
    return prisma.customerProfile.count({ where: { createdAt: { gte: from, lte: to } } });
  }

  countAiTechnicians() {
    return prisma.aiTechnicianProfile.count();
  }

  countDoctors() {
    return prisma.doctorProfile.count();
  }

  countDoctorsVerified() {
    return prisma.doctorProfile.count({
      where: { providerStatus: ProviderStatus.ACTIVE, verifiedAt: { not: null } },
    });
  }

  countDoctorsPending() {
    return prisma.doctorProfile.count({
      where: { providerStatus: ProviderStatus.PENDING_VERIFICATION },
    });
  }

  countConsultations(where: Record<string, unknown> = {}) {
    return prisma.serviceRequest.count({ where: { ...consultationFilter, ...where } });
  }

  countServiceRequests(where: Record<string, unknown> = {}) {
    return prisma.serviceRequest.count({ where });
  }

  countTreatmentCases(where: Record<string, unknown> = {}) {
    return prisma.treatmentCase.count({ where });
  }

  countEmergencyInRange(from: Date, to: Date) {
    return prisma.serviceRequest.count({
      where: {
        submittedAt: { gte: from, lte: to },
        ...emergencyWhere(),
      },
    });
  }

  aggregateRevenue(from: Date, to: Date, basis: 'paid' | 'issued') {
    const dateField = basis === 'paid' ? 'paidAt' : 'issuedAt';
    return prisma.billingRecord.aggregate({
      where: {
        status: { in: REVENUE_BILLING_STATUSES },
        [dateField]: { gte: from, lte: to, not: null },
      },
      _sum: {
        total: true,
        platformCommission: true,
        providerPayout: true,
      },
    });
  }

  async revenueByServiceType(from: Date, to: Date, basis: 'paid' | 'issued') {
    type Row = { service_type: string; total_bdt: string; commission_bdt: string };
    if (basis === 'paid') {
      return prisma.$queryRaw<Row[]>`
        SELECT sr."requestType" AS service_type,
               COALESCE(SUM(br.total), 0) AS total_bdt,
               COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
        FROM "BillingRecord" br
        INNER JOIN "ServiceRequest" sr ON sr.id = br."serviceRequestId"
        WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          AND br."paidAt" IS NOT NULL
          AND br."paidAt" >= ${from} AND br."paidAt" <= ${to}
        GROUP BY sr."requestType"
      `;
    }
    return prisma.$queryRaw<Row[]>`
      SELECT sr."requestType" AS service_type,
             COALESCE(SUM(br.total), 0) AS total_bdt,
             COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
      FROM "BillingRecord" br
      INNER JOIN "ServiceRequest" sr ON sr.id = br."serviceRequestId"
        WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          AND br."issuedAt" IS NOT NULL
          AND br."issuedAt" >= ${from} AND br."issuedAt" <= ${to}
      GROUP BY sr."requestType"
    `;
  }

  async revenueTimeSeries(
    from: Date,
    to: Date,
    grain: 'day' | 'week' | 'month' | 'year',
    basis: 'paid' | 'issued',
  ) {
    type Row = { bucket: Date; total_bdt: string; commission_bdt: string };
    const truncLiteral =
      grain === 'week' ? 'week' : grain === 'month' ? 'month' : grain === 'year' ? 'year' : 'day';

    if (basis === 'paid') {
      if (truncLiteral === 'day') {
        return prisma.$queryRaw<Row[]>`
          SELECT date_trunc('day', br."paidAt") AS bucket,
                 COALESCE(SUM(br.total), 0) AS total_bdt,
                 COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
          FROM "BillingRecord" br
          WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
            AND br."paidAt" IS NOT NULL
            AND br."paidAt" >= ${from} AND br."paidAt" <= ${to}
          GROUP BY 1 ORDER BY 1 ASC
        `;
      }
      if (truncLiteral === 'week') {
        return prisma.$queryRaw<Row[]>`
          SELECT date_trunc('week', br."paidAt") AS bucket,
                 COALESCE(SUM(br.total), 0) AS total_bdt,
                 COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
          FROM "BillingRecord" br
          WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
            AND br."paidAt" IS NOT NULL
            AND br."paidAt" >= ${from} AND br."paidAt" <= ${to}
          GROUP BY 1 ORDER BY 1 ASC
        `;
      }
      if (truncLiteral === 'month') {
        return prisma.$queryRaw<Row[]>`
          SELECT date_trunc('month', br."paidAt") AS bucket,
                 COALESCE(SUM(br.total), 0) AS total_bdt,
                 COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
          FROM "BillingRecord" br
          WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
            AND br."paidAt" IS NOT NULL
            AND br."paidAt" >= ${from} AND br."paidAt" <= ${to}
          GROUP BY 1 ORDER BY 1 ASC
        `;
      }
      return prisma.$queryRaw<Row[]>`
        SELECT date_trunc('year', br."paidAt") AS bucket,
               COALESCE(SUM(br.total), 0) AS total_bdt,
               COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
        FROM "BillingRecord" br
        WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          AND br."paidAt" IS NOT NULL
          AND br."paidAt" >= ${from} AND br."paidAt" <= ${to}
        GROUP BY 1 ORDER BY 1 ASC
      `;
    }

    if (truncLiteral === 'day') {
      return prisma.$queryRaw<Row[]>`
        SELECT date_trunc('day', br."issuedAt") AS bucket,
               COALESCE(SUM(br.total), 0) AS total_bdt,
               COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
        FROM "BillingRecord" br
        WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          AND br."issuedAt" IS NOT NULL
          AND br."issuedAt" >= ${from} AND br."issuedAt" <= ${to}
        GROUP BY 1 ORDER BY 1 ASC
      `;
    }
    if (truncLiteral === 'week') {
      return prisma.$queryRaw<Row[]>`
        SELECT date_trunc('week', br."issuedAt") AS bucket,
               COALESCE(SUM(br.total), 0) AS total_bdt,
               COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
        FROM "BillingRecord" br
        WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          AND br."issuedAt" IS NOT NULL
          AND br."issuedAt" >= ${from} AND br."issuedAt" <= ${to}
        GROUP BY 1 ORDER BY 1 ASC
      `;
    }
    if (truncLiteral === 'month') {
      return prisma.$queryRaw<Row[]>`
        SELECT date_trunc('month', br."issuedAt") AS bucket,
               COALESCE(SUM(br.total), 0) AS total_bdt,
               COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
        FROM "BillingRecord" br
        WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          AND br."issuedAt" IS NOT NULL
          AND br."issuedAt" >= ${from} AND br."issuedAt" <= ${to}
        GROUP BY 1 ORDER BY 1 ASC
      `;
    }
    return prisma.$queryRaw<Row[]>`
      SELECT date_trunc('year', br."issuedAt") AS bucket,
             COALESCE(SUM(br.total), 0) AS total_bdt,
             COALESCE(SUM(br."platformCommission"), 0) AS commission_bdt
      FROM "BillingRecord" br
      WHERE br.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
        AND br."issuedAt" IS NOT NULL
        AND br."issuedAt" >= ${from} AND br."issuedAt" <= ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `;
  }

  serviceRequestsByStatusInRange(from: Date, to: Date) {
    return prisma.serviceRequest.groupBy({
      by: ['status'],
      where: { submittedAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
  }

  async farmerRegistrationTrend(from: Date, to: Date) {
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS bucket, COUNT(*)::bigint AS count
      FROM "CustomerProfile"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows;
  }

  async registrationTrend(from: Date, to: Date) {
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS bucket, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND status != 'DELETED'
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows;
  }

  async consultationTrend(from: Date, to: Date) {
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
      SELECT date_trunc('day', "submittedAt") AS bucket, COUNT(*)::bigint AS count
      FROM "ServiceRequest"
      WHERE "submittedAt" >= ${from} AND "submittedAt" <= ${to}
        AND "requestType" IN ('DOCTOR_HOME_VISIT', 'EMERGENCY_DOCTOR', 'ONLINE_CONSULTATION_LATER')
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows;
  }

  async activeFarmersInRange(from: Date, to: Date) {
    const rows = await prisma.serviceRequest.findMany({
      where: { submittedAt: { gte: from, lte: to } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    return rows.length;
  }

  async farmerConsultationFrequency(from: Date, to: Date) {
    const rows = await prisma.serviceRequest.groupBy({
      by: ['customerId'],
      where: { submittedAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    if (rows.length === 0) return 0;
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    return total / rows.length;
  }

  async farmerRetentionRate(): Promise<number | null> {
    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    const prevEnd = new Date(periodStart.getTime() - 1);
    const prevStart = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), 1));

    const [cohort, returned] = await Promise.all([
      prisma.customerProfile.findMany({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        select: { id: true },
      }),
      prisma.serviceRequest.findMany({
        where: { submittedAt: { gte: periodStart, lte: periodEnd } },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
    ]);
    if (cohort.length === 0) return null;
    const returnedSet = new Set(returned.map((r) => r.customerId));
    const retained = cohort.filter((c) => returnedSet.has(c.id)).length;
    return retained / cohort.length;
  }

  async doctorLeaderboard(from: Date, to: Date, limit: number) {
    const completed = await prisma.serviceRequest.groupBy({
      by: ['assignedDoctorId'],
      where: {
        assignedDoctorId: { not: null },
        status: ServiceRequestStatus.COMPLETED,
        submittedAt: { gte: from, lte: to },
        ...consultationFilter,
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: limit,
    });

    const doctorIds = completed
      .map((r) => r.assignedDoctorId)
      .filter((id): id is string => id != null);

    if (doctorIds.length === 0) return [];

    const [profiles, ratings, earnings, responseRows] = await Promise.all([
      prisma.doctorProfile.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, displayName: true, userId: true, providerStatus: true },
      }),
      prisma.review.groupBy({
        by: ['doctorId'],
        where: {
          doctorId: { in: doctorIds },
          status: ReviewStatus.APPROVED,
          createdAt: { gte: from, lte: to },
        },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.billingRecord.groupBy({
        by: ['doctorId'],
        where: {
          doctorId: { in: doctorIds },
          status: { in: REVENUE_BILLING_STATUSES },
          paidAt: { gte: from, lte: to, not: null },
        },
        _sum: { providerPayout: true, total: true, platformCommission: true },
      }),
      prisma.$queryRaw<
        Array<{ doctor_id: string; avg_minutes: number | null }>
      >`
        SELECT sr."assignedDoctorId" AS doctor_id,
               AVG(EXTRACT(EPOCH FROM (sr."assignedAt" - sr."submittedAt")) / 60.0) AS avg_minutes
        FROM "ServiceRequest" sr
        WHERE sr."assignedDoctorId" IN (${Prisma.join(doctorIds)})
          AND sr."submittedAt" >= ${from}
          AND sr."submittedAt" <= ${to}
          AND sr."assignedAt" IS NOT NULL
        GROUP BY sr."assignedDoctorId"
      `,
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const ratingMap = new Map(ratings.map((r) => [r.doctorId, r]));
    const earningMap = new Map(earnings.map((e) => [e.doctorId, e]));
    const responseMap = new Map(responseRows.map((r) => [r.doctor_id, r.avg_minutes]));

    return completed
      .filter((r) => r.assignedDoctorId != null)
      .map((row) => {
        const doctorId = row.assignedDoctorId!;
        const profile = profileMap.get(doctorId);
        const rating = ratingMap.get(doctorId);
        const earning = earningMap.get(doctorId);
        const consultations = row._count._all;
        return {
          doctorId,
          name: profile?.displayName ?? 'Unknown',
          consultations,
          averageRating: rating?._avg.rating ?? null,
          ratingCount: rating?._count._all ?? 0,
          earningsBdt: Number(earning?._sum.providerPayout ?? earning?._sum.total ?? 0),
          commissionBdt: Number(earning?._sum.platformCommission ?? 0),
          avgResponseMinutes: responseMap.get(doctorId) ?? null,
          providerStatus: profile?.providerStatus ?? null,
        };
      })
      .sort((a, b) => b.consultations - a.consultations)
      .slice(0, limit);
  }

  async doctorAcceptanceRates(from: Date, to: Date) {
    const rangeWhere = { submittedAt: { gte: from, lte: to }, ...consultationFilter };
    const [accepted, rejected, total] = await Promise.all([
      prisma.serviceRequest.count({
        where: {
          ...rangeWhere,
          status: {
            in: [
              ServiceRequestStatus.ACCEPTED,
              ServiceRequestStatus.ASSIGNED,
              ServiceRequestStatus.IN_PROGRESS,
              ServiceRequestStatus.COMPLETED,
            ],
          },
          assignedDoctorId: { not: null },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          ...rangeWhere,
          status: ServiceRequestStatus.REJECTED,
        },
      }),
      prisma.serviceRequest.count({ where: rangeWhere }),
    ]);
    const decided = accepted + rejected;
    return {
      acceptanceRate: decided > 0 ? accepted / decided : null,
      completionRate:
        total > 0
          ? (await prisma.serviceRequest.count({
              where: {
                submittedAt: { gte: from, lte: to },
                status: ServiceRequestStatus.COMPLETED,
                ...consultationFilter,
              },
            })) / total
          : null,
    };
  }

  async livestockCasesByAnimalType(from: Date, to: Date) {
    const rows = await prisma.treatmentCase.groupBy({
      by: ['animalId'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    const animalIds = rows.map((r) => r.animalId);
    if (animalIds.length === 0) {
      return { cow: 0, goat: 0, poultry: 0, pet: 0, other: 0 };
    }
    const animals = await prisma.animalProfile.findMany({
      where: { id: { in: animalIds } },
      select: { id: true, animalType: true },
    });
    const typeMap = new Map(animals.map((a) => [a.id, a.animalType]));
    const buckets = { cow: 0, goat: 0, poultry: 0, pet: 0, other: 0 };
    for (const row of rows) {
      const t = typeMap.get(row.animalId);
      const n = row._count._all;
      if (t === AnimalType.CATTLE) buckets.cow += n;
      else if (t === AnimalType.GOAT) buckets.goat += n;
      else if (t === AnimalType.POULTRY) buckets.poultry += n;
      else if (t === AnimalType.DOG || t === AnimalType.CAT) buckets.pet += n;
      else buckets.other += n;
    }
    return buckets;
  }

  async topDiseases(from: Date, to: Date, limit: number) {
    const rows = await prisma.$queryRaw<Array<{ label: string; count: bigint }>>`
      SELECT TRIM(COALESCE(NULLIF(diagnosis, ''), NULLIF(symptoms, ''), 'Unknown')) AS label,
             COUNT(*)::bigint AS count
      FROM "TreatmentRecord"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      HAVING TRIM(COALESCE(NULLIF(diagnosis, ''), NULLIF(symptoms, ''), 'Unknown')) <> ''
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      label: r.label.slice(0, 120),
      count: Number(r.count),
    }));
  }

  countFarmLivestock() {
    return prisma.livestock.groupBy({
      by: ['species'],
      _count: { id: true },
    });
  }

  async geographyByAreaLevel(
    from: Date,
    to: Date,
    level: 'division' | 'district' | 'upazila',
  ) {
    const areaType: AreaType =
      level === 'division'
        ? AreaType.DIVISION
        : level === 'district'
          ? AreaType.DISTRICT
          : AreaType.UPAZILA;

    const rows = await prisma.$queryRaw<
      Array<{ area_id: string; area_name: string; request_count: bigint }>
    >`
      SELECT a.id AS area_id, COALESCE(a."nameBn", a.name) AS area_name,
             COUNT(sr.id)::bigint AS request_count
      FROM "ServiceRequest" sr
      INNER JOIN "Area" a ON a.id = sr."areaId"
      WHERE sr."submittedAt" >= ${from} AND sr."submittedAt" <= ${to}
        AND a.type = ${areaType}::"AreaType"
      GROUP BY a.id, a.name, a."nameBn"
      ORDER BY request_count DESC
      LIMIT 50
    `;
    return rows;
  }

  async geographyHeatmap(from: Date, to: Date, limit: number) {
    const rows = await prisma.$queryRaw<
      Array<{
        village_id: string;
        label: string;
        lat: string;
        lng: string;
        weight: bigint;
      }>
    >`
      SELECT v.id AS village_id,
             COALESCE(v."nameBn", v.name) AS label,
             v.latitude::text AS lat,
             v.longitude::text AS lng,
             COUNT(sr.id)::bigint AS weight
      FROM "ServiceRequest" sr
      INNER JOIN "Village" v ON v.id = sr."villageId"
      WHERE sr."submittedAt" >= ${from} AND sr."submittedAt" <= ${to}
        AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
      GROUP BY v.id, v.name, v."nameBn", v.latitude, v.longitude
      ORDER BY weight DESC
      LIMIT ${limit}
    `;
    return rows;
  }

  offlineQueueStats() {
    return prisma.offlineSyncItem.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
  }

  countActiveSessions() {
    return prisma.userSession.count({ where: { status: SessionStatus.ACTIVE } });
  }

  countUsersByRole() {
    return prisma.user.groupBy({
      by: ['role'],
      where: { status: { not: UserStatus.DELETED } },
      _count: { _all: true },
    });
  }

  getDefaultActiveUserDays(queryDays?: number) {
    return queryDays ?? DEFAULT_ACTIVE_USER_DAYS;
  }

  rangeFilter(range: ResolvedDateRange) {
    return { gte: range.from, lte: range.to };
  }
}

let repositorySingleton: AdminAnalyticsRepository | undefined;

export function getAdminAnalyticsRepository(): AdminAnalyticsRepository {
  if (!repositorySingleton) {
    repositorySingleton = new AdminAnalyticsRepository();
  }
  return repositorySingleton;
}
