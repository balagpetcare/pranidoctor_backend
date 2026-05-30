/** Closed beta launch configuration — stored in Setting `launch.closedBeta.config`. */

export const CLOSED_BETA_SETTING_KEY = 'launch.closedBeta.config';

export type BetaCohort = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'NONE';

export type BetaParticipantTag = {
  cohort: BetaCohort;
  taggedAt: string;
  note?: string;
};

export type BetaDoctorTag = BetaParticipantTag & {
  acceptsEmergency?: boolean;
};

export type ClosedBetaMonitoringLinks = {
  grafana?: string;
  sentry?: string;
  uptime?: string;
  launchOps?: string;
};

export type ClosedBetaConfig = {
  enabled: boolean;
  enforceInviteList: boolean;
  enforceUserCap: boolean;
  maxUsers: number;
  maxDoctors: number;
  activeCohort: BetaCohort;
  invitedPhones: string[];
  betaUserTags: Record<string, BetaParticipantTag>;
  betaDoctorTags: Record<string, BetaDoctorTag>;
  pilotAreaIds: string[];
  feedbackEnabled: boolean;
  betaBanner: { en?: string; bn?: string } | null;
  doctorSupportWhatsapp: string | null;
  userSupportWhatsapp: string | null;
  monitoringLinks: ClosedBetaMonitoringLinks;
  contentVersion: string;
};

export type ClosedBetaPublicStatus = {
  enabled: boolean;
  feedbackEnabled: boolean;
  betaBanner: { en?: string; bn?: string } | null;
  activeCohort: BetaCohort;
  supportWhatsapp: string | null;
};

export type ClosedBetaDashboardMetrics = {
  generatedAt: string;
  config: Pick<
    ClosedBetaConfig,
    | 'enabled'
    | 'activeCohort'
    | 'maxUsers'
    | 'maxDoctors'
    | 'enforceInviteList'
    | 'feedbackEnabled'
  >;
  users: {
    totalBetaTagged: number;
    registeredLast7Days: number;
    activatedLast7Days: number;
    capRemaining: number | null;
  };
  doctors: {
    totalBetaTagged: number;
    activeVerified: number;
    acceptingEmergency: number;
    capRemaining: number | null;
  };
  consultations: {
    totalRequests: number;
    pending: number;
    completed: number;
    emergencyRequests: number;
    completionRatePct: number | null;
  };
  ai: {
    sessionsLast7Days: number;
    escalationsOpen: number;
    llmDisabled: boolean;
  };
  support: {
    openTickets: number;
    betaFeedbackTicketsLast7Days: number;
  };
  systemHealth: {
    ready: boolean;
    aiGovernanceHydrated: boolean;
    llmDisabled: boolean;
  };
};

export const DEFAULT_CLOSED_BETA_CONFIG: ClosedBetaConfig = {
  enabled: false,
  enforceInviteList: false,
  enforceUserCap: true,
  maxUsers: 80,
  maxDoctors: 5,
  activeCohort: 'NONE',
  invitedPhones: [],
  betaUserTags: {},
  betaDoctorTags: {},
  pilotAreaIds: [],
  feedbackEnabled: true,
  betaBanner: {
    en: 'You are using a closed beta. Features may change and support is best-effort.',
    bn: 'আপনি একটি বন্ধ বিটা ব্যবহার করছেন। বৈশিষ্ট্য পরিবর্তন হতে পারে এবং সহায়তা সর্বোত্তম প্রচেষ্টার ভিত্তিতে।',
  },
  doctorSupportWhatsapp: null,
  userSupportWhatsapp: null,
  monitoringLinks: {},
  contentVersion: '2026-05-30',
};
