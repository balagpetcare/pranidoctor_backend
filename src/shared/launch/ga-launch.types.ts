/** General availability launch configuration — Setting `launch.ga.config`. */

export const GA_LAUNCH_SETTING_KEY = 'launch.ga.config';

export type GaLaunchPhase =
  | 'PRE_GA'
  | 'SOFT_LAUNCH'
  | 'GRADUAL_ROLLOUT'
  | 'FULL_LAUNCH'
  | 'PAUSED';

export type GoNoGoVerdict = 'NO_GO' | 'GO_WITH_CONDITIONS' | 'GO';

export type GaChecklistItemStatus = 'open' | 'pass' | 'fail' | 'waived';

export type GaChecklistPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type GaChecklistItem = {
  id: string;
  label: string;
  priority: GaChecklistPriority;
  status: GaChecklistItemStatus;
  owner?: string;
  evidence?: string;
  updatedAt?: string;
};

export type GaLaunchOwnership = {
  launchLead?: string;
  sreOnCall?: string;
  rollbackAuthority?: string;
  incidentCommander?: string;
  aiSafetyOwner?: string;
  legalLiaison?: string;
  productOps?: string;
};

export type GaMonitoringLinks = {
  grafana?: string;
  sentry?: string;
  uptime?: string;
  statusPage?: string;
  launchOps?: string;
  warRoom?: string;
};

export type GaLaunchConfig = {
  /** Public GA rollout active (distinct from closed beta). */
  enabled: boolean;
  phase: GaLaunchPhase;
  goNoGoVerdict: GoNoGoVerdict;
  playRolloutPct: number;
  weeklyRegistrationCap: number | null;
  minDoctorsForPhase: number;
  targetDistrictIds: string[];
  closedBetaDisabled: boolean;
  ownership: GaLaunchOwnership;
  monitoringLinks: GaMonitoringLinks;
  gateChecklist: GaChecklistItem[];
  lastGateReviewAt: string | null;
  lastGateReviewBy: string | null;
  contentVersion: string;
};

export type GaDashboardMetrics = {
  generatedAt: string;
  config: Pick<
    GaLaunchConfig,
    | 'enabled'
    | 'phase'
    | 'goNoGoVerdict'
    | 'playRolloutPct'
    | 'weeklyRegistrationCap'
    | 'minDoctorsForPhase'
  >;
  users: {
    totalCustomers: number;
    registeredLast7Days: number;
    activatedLast7Days: number;
    registrationsLast7Days: number;
    weeklyCapRemaining: number | null;
  };
  doctors: {
    activeVerified: number;
    acceptingEmergency: number;
    minRequired: number;
    supplyOk: boolean;
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
    gaFeedbackTicketsLast7Days: number;
  };
  incident: {
    openSev1Placeholder: number;
    warRoomUrl: string | null;
  };
  systemHealth: {
    ready: boolean;
    aiGovernanceHydrated: boolean;
    llmDisabled: boolean;
  };
};

export type GaReadinessCheck = {
  id: string;
  domain: 'platform' | 'monitoring' | 'security' | 'compliance' | 'operations' | 'scaling';
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  priority: GaChecklistPriority;
  detail?: string;
};

export type GaReadinessScores = {
  technical: number;
  operational: number;
  compliance: number;
  security: number;
  business: number;
  overall: number;
};

export type GaReadinessSnapshot = {
  generatedAt: string;
  verdict: GoNoGoVerdict;
  scores: GaReadinessScores;
  checks: GaReadinessCheck[];
  checklistSummary: {
    total: number;
    pass: number;
    fail: number;
    open: number;
    waived: number;
    p0Open: number;
  };
  rolloutRecommendation: string;
};

export const DEFAULT_GA_LAUNCH_CONFIG: GaLaunchConfig = {
  enabled: false,
  phase: 'PRE_GA',
  goNoGoVerdict: 'NO_GO',
  playRolloutPct: 0,
  weeklyRegistrationCap: 500,
  minDoctorsForPhase: 15,
  targetDistrictIds: [],
  closedBetaDisabled: true,
  ownership: {},
  monitoringLinks: {},
  gateChecklist: [],
  lastGateReviewAt: null,
  lastGateReviewBy: null,
  contentVersion: '2026-06-01',
};
