import {
  ServiceRequestStatus,
  ServiceRequestType,
} from '../../generated/prisma/index.js';
import { buildCacheKey, getCached, setCached } from './admin-analytics.cache.js';
import { resolveAnalyticsDateRange } from './admin-analytics.date-range.js';
import type { AdminAnalyticsDateRangeQuery } from './admin-analytics.schemas.js';
import { getAdminAnalyticsRepository } from './admin-analytics.repository.js';
import {
  serviceRequestStatusLabel,
  serviceRequestTypeLabel,
} from './admin-analytics.labels.js';
import type {
  DoctorsPayload,
  FarmersPayload,
  GeographyPayload,
  LivestockPayload,
  OverviewPayload,
  RevenuePayload,
  SystemPayload,
} from './admin-analytics.types.js';

function dec(value: unknown): number {
  if (value == null) return 0;
  return Number(value);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function bucketToKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export class AdminAnalyticsService {
  constructor(private readonly repo = getAdminAnalyticsRepository()) {}

  async getOverview(query: AdminAnalyticsDateRangeQuery): Promise<OverviewPayload> {
    const range = resolveAnalyticsDateRange(query);
    const activeDays = this.repo.getDefaultActiveUserDays(query.activeUserDays);
    const cacheKey = buildCacheKey('overview', {
      from: range.fromKey,
      to: range.toKey,
      activeDays,
    });
    const cached = getCached<OverviewPayload>(cacheKey);
    if (cached) return cached;

    const activeSince = new Date(range.to.getTime() - activeDays * 24 * 60 * 60 * 1000);
    const rf = this.repo.rangeFilter(range);
    const prevRf = { gte: range.previousFrom, lte: range.previousTo };

    const [
      totalUsers,
      activeUsers,
      newRegistrations,
      totalFarmers,
      totalDoctors,
      verifiedDoctors,
      pendingDoctors,
      totalConsultations,
      completedConsultations,
      cancelledConsultations,
      emergencyCalls,
      livestockCases,
      prevNewRegistrations,
      prevCompletedConsultations,
      registrationTrend,
      consultationTrend,
      statusGroups,
      totalAiTechnicians,
    ] = await Promise.all([
      this.repo.countUsers(),
      this.repo.countActiveUsers(activeSince),
      this.repo.countUsersCreatedBetween(range.from, range.to),
      this.repo.countFarmers(),
      this.repo.countDoctors(),
      this.repo.countDoctorsVerified(),
      this.repo.countDoctorsPending(),
      this.repo.countConsultations({ submittedAt: rf }),
      this.repo.countConsultations({ submittedAt: rf, status: ServiceRequestStatus.COMPLETED }),
      this.repo.countConsultations({ submittedAt: rf, status: ServiceRequestStatus.CANCELLED }),
      this.repo.countEmergencyInRange(range.from, range.to),
      this.repo.countTreatmentCases({ createdAt: rf }),
      this.repo.countUsersCreatedBetween(range.previousFrom, range.previousTo),
      this.repo.countConsultations({
        submittedAt: prevRf,
        status: ServiceRequestStatus.COMPLETED,
      }),
      this.repo.registrationTrend(range.from, range.to),
      this.repo.consultationTrend(range.from, range.to),
      this.repo.serviceRequestsByStatusInRange(range.from, range.to),
      this.repo.countAiTechnicians(),
    ]);

    const payload: OverviewPayload = {
      period: { from: range.fromKey, to: range.toKey },
      generatedAt: new Date().toISOString(),
      kpis: {
        totalUsers,
        activeUsers,
        newRegistrations,
        totalFarmers,
        totalDoctors,
        verifiedDoctors,
        pendingDoctors,
        totalConsultations,
        completedConsultations,
        cancelledConsultations,
        emergencyCalls,
        livestockCases,
        totalAiTechnicians,
      },
      comparison: {
        newRegistrationsDeltaPercent: pctChange(newRegistrations, prevNewRegistrations),
        completedConsultationsDeltaPercent: pctChange(
          completedConsultations,
          prevCompletedConsultations,
        ),
      },
      trends: {
        registrations: registrationTrend.map((r) => ({
          date: bucketToKey(r.bucket),
          value: Number(r.count),
        })),
        consultations: consultationTrend.map((r) => ({
          date: bucketToKey(r.bucket),
          value: Number(r.count),
        })),
      },
      charts: {
        serviceRequestsByStatus: statusGroups.map((row) => ({
          key: row.status,
          label: serviceRequestStatusLabel(row.status),
          value: row._count._all,
        })),
        teamComposition: [
          { key: 'doctors', label: 'Doctors', value: totalDoctors },
          { key: 'ai', label: 'AI Technicians', value: totalAiTechnicians },
          { key: 'farmers', label: 'Farmers', value: totalFarmers },
        ],
      },
    };

    setCached(cacheKey, payload);
    return payload;
  }

  async getRevenue(query: AdminAnalyticsDateRangeQuery): Promise<RevenuePayload> {
    const range = resolveAnalyticsDateRange(query);
    const basis = query.basis ?? 'paid';
    const grain = query.grain ?? 'day';
    const cacheKey = buildCacheKey('revenue', {
      from: range.fromKey,
      to: range.toKey,
      basis,
      grain,
    });
    const cached = getCached<RevenuePayload>(cacheKey);
    if (cached) return cached;

    const [agg, series, byType] = await Promise.all([
      this.repo.aggregateRevenue(range.from, range.to, basis),
      this.repo.revenueTimeSeries(range.from, range.to, grain, basis),
      this.repo.revenueByServiceType(range.from, range.to, basis),
    ]);

    const consultationTypes = new Set<string>([
      ServiceRequestType.DOCTOR_HOME_VISIT,
      ServiceRequestType.EMERGENCY_DOCTOR,
      ServiceRequestType.ONLINE_CONSULTATION_LATER,
    ]);

    let consultationRevenue = 0;
    let emergencyRevenue = 0;
    for (const row of byType) {
      const amount = dec(row.total_bdt);
      if (consultationTypes.has(row.service_type)) consultationRevenue += amount;
      if (row.service_type === ServiceRequestType.EMERGENCY_DOCTOR) {
        emergencyRevenue += amount;
      }
    }

    const payload: RevenuePayload = {
      period: { from: range.fromKey, to: range.toKey },
      basis,
      grain,
      summary: {
        totalRevenueBdt: dec(agg._sum.total),
        commissionBdt: dec(agg._sum.platformCommission),
        providerPayoutBdt: dec(agg._sum.providerPayout),
        consultationRevenueBdt: consultationRevenue,
        emergencyRevenueBdt: emergencyRevenue,
      },
      series: series.map((row) => ({
        date: bucketToKey(row.bucket),
        revenueBdt: dec(row.total_bdt),
        commissionBdt: dec(row.commission_bdt),
      })),
      byServiceType: byType.map((row) => ({
        serviceType: row.service_type,
        serviceTypeLabel: serviceRequestTypeLabel(row.service_type as ServiceRequestType),
        revenueBdt: dec(row.total_bdt),
        commissionBdt: dec(row.commission_bdt),
      })),
    };

    setCached(cacheKey, payload);
    return payload;
  }

  async getDoctors(query: AdminAnalyticsDateRangeQuery): Promise<DoctorsPayload> {
    const range = resolveAnalyticsDateRange(query);
    const limit = query.limit ?? 20;
    const cacheKey = buildCacheKey('doctors', { from: range.fromKey, to: range.toKey, limit });
    const cached = getCached<DoctorsPayload>(cacheKey);
    if (cached) return cached;

    const [leaderboardRaw, rates, totalDoctors, verifiedDoctors, pendingDoctors] =
      await Promise.all([
        this.repo.doctorLeaderboard(range.from, range.to, limit),
        this.repo.doctorAcceptanceRates(range.from, range.to),
        this.repo.countDoctors(),
        this.repo.countDoctorsVerified(),
        this.repo.countDoctorsPending(),
      ]);

    const leaderboard = sortDoctorLeaderboard(leaderboardRaw, query.sort ?? 'consultations');

    const payload: DoctorsPayload = {
      period: { from: range.fromKey, to: range.toKey },
      summary: {
        totalDoctors,
        verifiedDoctors,
        pendingDoctors,
        acceptanceRate: rates.acceptanceRate,
        completionRate: rates.completionRate,
      },
      leaderboard,
    };

    setCached(cacheKey, payload);
    return payload;
  }

  async getFarmers(query: AdminAnalyticsDateRangeQuery): Promise<FarmersPayload> {
    const range = resolveAnalyticsDateRange(query);
    const cacheKey = buildCacheKey('farmers', { from: range.fromKey, to: range.toKey });
    const cached = getCached<FarmersPayload>(cacheKey);
    if (cached) return cached;

    const [totalFarmers, newFarmers, activeFarmers, avgFrequency, retentionRate, trend] =
      await Promise.all([
        this.repo.countFarmers(),
        this.repo.countFarmersCreatedBetween(range.from, range.to),
        this.repo.activeFarmersInRange(range.from, range.to),
        this.repo.farmerConsultationFrequency(range.from, range.to),
        this.repo.farmerRetentionRate(),
        this.repo.farmerRegistrationTrend(range.from, range.to),
      ]);

    const payload: FarmersPayload = {
      period: { from: range.fromKey, to: range.toKey },
      summary: {
        totalFarmers,
        newFarmers,
        activeFarmers,
        avgConsultationsPerActiveFarmer: avgFrequency,
        retentionRate,
      },
      trends: {
        newFarmers: trend.map((r) => ({
          date: bucketToKey(r.bucket),
          value: Number(r.count),
        })),
      },
    };

    setCached(cacheKey, payload);
    return payload;
  }

  async getLivestock(query: AdminAnalyticsDateRangeQuery): Promise<LivestockPayload> {
    const range = resolveAnalyticsDateRange(query);
    const limit = query.limit ?? 15;
    const cacheKey = buildCacheKey('livestock', { from: range.fromKey, to: range.toKey, limit });
    const cached = getCached<LivestockPayload>(cacheKey);
    if (cached) return cached;

    const [casesBySpecies, topDiseases, farmSpecies, totalCases] = await Promise.all([
      this.repo.livestockCasesByAnimalType(range.from, range.to),
      this.repo.topDiseases(range.from, range.to, limit),
      this.repo.countFarmLivestock(),
      this.repo.countTreatmentCases({ createdAt: this.repo.rangeFilter(range) }),
    ]);

    const payload: LivestockPayload = {
      period: { from: range.fromKey, to: range.toKey },
      clinical: {
        totalCases,
        casesBySpecies,
        topDiseases,
      },
      farmRegistry: {
        bySpecies: farmSpecies.map((row) => ({
          species: row.species,
          count: row._count.id,
        })),
      },
    };

    setCached(cacheKey, payload);
    return payload;
  }

  async getGeography(query: AdminAnalyticsDateRangeQuery): Promise<GeographyPayload> {
    const range = resolveAnalyticsDateRange(query);
    const level = query.level ?? 'district';
    const cacheKey = buildCacheKey('geography', {
      from: range.fromKey,
      to: range.toKey,
      level,
    });
    const cached = getCached<GeographyPayload>(cacheKey);
    if (cached) return cached;

    const [regions, heatmap] = await Promise.all([
      this.repo.geographyByAreaLevel(range.from, range.to, level),
      this.repo.geographyHeatmap(range.from, range.to, 200),
    ]);

    const payload: GeographyPayload = {
      period: { from: range.fromKey, to: range.toKey },
      level,
      regions: regions.map((r) => ({
        areaId: r.area_id,
        name: r.area_name,
        requestCount: Number(r.request_count),
      })),
      heatmap: heatmap
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({
          villageId: p.village_id,
          label: p.label,
          lat: Number(p.lat),
          lng: Number(p.lng),
          weight: Number(p.weight),
        })),
    };

    setCached(cacheKey, payload);
    return payload;
  }

  async getSystem(query: AdminAnalyticsDateRangeQuery): Promise<SystemPayload> {
    const cacheKey = buildCacheKey('system', { from: query.from ?? '', to: query.to ?? '' });
    const cached = getCached<SystemPayload>(cacheKey);
    if (cached) return cached;

    const [queueGroups, activeSessions, usersByRole] = await Promise.all([
      this.repo.offlineQueueStats(),
      this.repo.countActiveSessions(),
      this.repo.countUsersByRole(),
    ]);

    const payload: SystemPayload = {
      generatedAt: new Date().toISOString(),
      offlineQueue: queueGroups.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      activeSessions,
      usersByRole: usersByRole.map((row) => ({
        role: row.role,
        count: row._count._all,
      })),
      apiMetrics: {
        available: false,
        message: 'Integrate APM (Sentry/Datadog) for API latency and error rates',
      },
    };

    setCached(cacheKey, payload);
    return payload;
  }

  getReportsCatalog() {
    return {
      reports: [
        { id: 'overview', label: 'Executive overview', formats: ['csv', 'json'] },
        { id: 'revenue', label: 'Revenue', formats: ['csv', 'json'] },
        { id: 'doctors', label: 'Doctor performance', formats: ['csv', 'json'] },
        { id: 'farmers', label: 'Farmer engagement', formats: ['csv', 'json'] },
        { id: 'livestock', label: 'Livestock cases', formats: ['csv', 'json'] },
        { id: 'geography', label: 'Geographic demand', formats: ['csv', 'json'] },
        { id: 'system', label: 'System health', formats: ['csv', 'json'] },
      ],
    };
  }

  async exportReport(query: AdminAnalyticsDateRangeQuery) {
    const report = query.report ?? 'overview';
    const format = query.format ?? 'json';

    let data: unknown;
    switch (report) {
      case 'overview':
        data = await this.getOverview(query);
        break;
      case 'revenue':
        data = await this.getRevenue(query);
        break;
      case 'doctors':
        data = await this.getDoctors(query);
        break;
      case 'farmers':
        data = await this.getFarmers(query);
        break;
      case 'livestock':
        data = await this.getLivestock(query);
        break;
      case 'geography':
        data = await this.getGeography(query);
        break;
      case 'system':
        data = await this.getSystem(query);
        break;
      default:
        data = await this.getOverview(query);
    }

    if (format === 'csv') {
      return { format: 'csv' as const, content: toCsv(data), filename: `${report}-${Date.now()}.csv` };
    }
    return { format: 'json' as const, data };
  }
}

function sortDoctorLeaderboard(
  rows: DoctorsPayload['leaderboard'],
  sort: NonNullable<AdminAnalyticsDateRangeQuery['sort']>,
): DoctorsPayload['leaderboard'] {
  const copy = [...rows];
  switch (sort) {
    case 'rating':
      copy.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
      break;
    case 'responseTime':
      copy.sort(
        (a, b) =>
          (a.avgResponseMinutes ?? Number.POSITIVE_INFINITY) -
          (b.avgResponseMinutes ?? Number.POSITIVE_INFINITY),
      );
      break;
    case 'earnings':
      copy.sort((a, b) => b.earningsBdt - a.earningsBdt);
      break;
    case 'completionRate':
      copy.sort((a, b) => b.consultations - a.consultations);
      break;
    case 'consultations':
    default:
      copy.sort((a, b) => b.consultations - a.consultations);
  }
  return copy;
}

function toCsv(data: unknown): string {
  const flat = flattenForCsv(data);
  if (flat.length === 0) return '';
  const headers = Object.keys(flat[0]!);
  const lines = [
    headers.join(','),
    ...flat.map((row) =>
      headers.map((h) => JSON.stringify(row[h] ?? '')).join(','),
    ),
  ];
  return lines.join('\n');
}

function flattenForCsv(data: unknown, prefix = ''): Record<string, string | number | null>[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.flatMap((item, i) => flattenForCsv(item, `${prefix}${i}.`));
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const primitive: Record<string, string | number | null> = {};
    let hasNested = false;
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && typeof v === 'object') {
        hasNested = true;
        break;
      }
      primitive[`${prefix}${k}`] =
        typeof v === 'number' || typeof v === 'string' || v === null
          ? (v as string | number | null)
          : String(v);
    }
    if (!hasNested) return [primitive];
    return Object.entries(obj).flatMap(([k, v]) => flattenForCsv(v, `${prefix}${k}.`));
  }
  return [{ [prefix.slice(0, -1)]: String(data) }];
}

let serviceSingleton: AdminAnalyticsService | undefined;

export function getAdminAnalyticsService(): AdminAnalyticsService {
  if (!serviceSingleton) {
    serviceSingleton = new AdminAnalyticsService();
  }
  return serviceSingleton;
}
