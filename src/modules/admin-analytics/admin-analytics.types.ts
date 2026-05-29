export type TrendPoint = { date: string; value: number };

export type ChartSlice = { key: string; label: string; value: number };

export type OverviewPayload = {
  period: { from: string; to: string };
  generatedAt: string;
  kpis: {
    totalUsers: number;
    activeUsers: number;
    newRegistrations: number;
    totalFarmers: number;
    totalDoctors: number;
    verifiedDoctors: number;
    pendingDoctors: number;
    totalConsultations: number;
    completedConsultations: number;
    cancelledConsultations: number;
    emergencyCalls: number;
    livestockCases: number;
    totalAiTechnicians: number;
  };
  comparison: {
    newRegistrationsDeltaPercent: number | null;
    completedConsultationsDeltaPercent: number | null;
  };
  trends: {
    registrations: TrendPoint[];
    consultations: TrendPoint[];
  };
  charts: {
    serviceRequestsByStatus: ChartSlice[];
    teamComposition: ChartSlice[];
  };
};

export type RevenuePayload = {
  period: { from: string; to: string };
  basis: string;
  grain: string;
  summary: {
    totalRevenueBdt: number;
    commissionBdt: number;
    providerPayoutBdt: number;
    consultationRevenueBdt: number;
    emergencyRevenueBdt: number;
  };
  series: Array<{ date: string; revenueBdt: number; commissionBdt: number }>;
  byServiceType: Array<{
    serviceType: string;
    serviceTypeLabel: string;
    revenueBdt: number;
    commissionBdt: number;
  }>;
};

export type DoctorsPayload = {
  period: { from: string; to: string };
  summary: {
    totalDoctors: number;
    verifiedDoctors: number;
    pendingDoctors: number;
    acceptanceRate: number | null;
    completionRate: number | null;
  };
  leaderboard: Array<{
    doctorId: string;
    name: string;
    consultations: number;
    averageRating: number | null;
    ratingCount: number;
    earningsBdt: number;
    commissionBdt: number;
    avgResponseMinutes: number | null;
    providerStatus: string | null;
  }>;
};

export type FarmersPayload = {
  period: { from: string; to: string };
  summary: {
    totalFarmers: number;
    newFarmers: number;
    activeFarmers: number;
    avgConsultationsPerActiveFarmer: number;
    retentionRate: number | null;
  };
  trends: { newFarmers: TrendPoint[] };
};

export type LivestockPayload = {
  period: { from: string; to: string };
  clinical: {
    totalCases: number;
    casesBySpecies: Record<string, number>;
    topDiseases: Array<{ label: string; count: number }>;
  };
  farmRegistry: {
    bySpecies: Array<{ species: string; count: number }>;
  };
};

export type GeographyPayload = {
  period: { from: string; to: string };
  level: string;
  regions: Array<{ areaId: string; name: string; requestCount: number }>;
  heatmap: Array<{
    villageId: string;
    label: string;
    lat: number;
    lng: number;
    weight: number;
  }>;
};

export type SystemPayload = {
  generatedAt: string;
  offlineQueue: Array<{ status: string; count: number }>;
  activeSessions: number;
  usersByRole: Array<{ role: string; count: number }>;
  apiMetrics: { available: boolean; message: string };
};
