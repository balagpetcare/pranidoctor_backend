import {
  deriveGoNoGoVerdict,
  getGaLaunchConfig,
  summarizeChecklist,
} from './ga-config.service.js';
import { buildGaDashboardMetrics } from './ga-metrics.service.js';
import type {
  GaReadinessCheck,
  GaReadinessScores,
  GaReadinessSnapshot,
  GoNoGoVerdict,
} from './ga-launch.types.js';

function envPresent(name: string): boolean {
  const v = process.env[name]?.trim();
  return Boolean(v && v.length > 0);
}

function scoreFromChecks(checks: GaReadinessCheck[], domain: GaReadinessCheck['domain']): number {
  const subset = checks.filter((c) => c.domain === domain);
  if (subset.length === 0) return 50;
  let points = 0;
  for (const c of subset) {
    if (c.status === 'pass') points += 100;
    else if (c.status === 'warn') points += 65;
    else if (c.status === 'unknown') points += 40;
  }
  return Math.round(points / subset.length);
}

function buildRolloutRecommendation(
  verdict: GoNoGoVerdict,
  phase: string,
  supplyOk: boolean,
): string {
  if (verdict === 'NO_GO') {
    return 'Do not enable GA_LAUNCH_ENABLED. Close P0 checklist items and re-run readiness review.';
  }
  if (verdict === 'GO_WITH_CONDITIONS') {
    return `Proceed with ${phase === 'PRE_GA' ? 'SOFT_LAUNCH' : phase} only; cap registrations; no paid marketing until P0 waived items closed.`;
  }
  if (!supplyOk) {
    return 'GO recorded but doctor supply below minimum — expand recruitment before marketing.';
  }
  return 'Follow phased rollout in docs/launch/ga-runbook.md (soft → gradual → full).';
}

export async function buildGaReadinessSnapshot(): Promise<GaReadinessSnapshot> {
  const config = await getGaLaunchConfig();
  const dashboard = await buildGaDashboardMetrics();
  const checklistSummary = summarizeChecklist(config);

  const checks: GaReadinessCheck[] = [
    {
      id: 'PR-MON-01',
      domain: 'monitoring',
      label: 'MONITORING_ALERT_WEBHOOK_URL configured',
      status: envPresent('MONITORING_ALERT_WEBHOOK_URL') ? 'pass' : 'fail',
      priority: 'P0',
    },
    {
      id: 'PR-MON-02',
      domain: 'monitoring',
      label: 'Sentry DSN configured',
      status: envPresent('SENTRY_DSN') ? 'pass' : 'warn',
      priority: 'P0',
    },
    {
      id: 'PR-MON-03',
      domain: 'monitoring',
      label: 'AI governance hydrated',
      status: dashboard.systemHealth.aiGovernanceHydrated ? 'pass' : 'warn',
      priority: 'P0',
    },
    {
      id: 'PR-SEC-01',
      domain: 'security',
      label: 'Production JWT secrets present',
      status:
        envPresent('MOBILE_JWT_SECRET') &&
        envPresent('ADMIN_JWT_SECRET') &&
        envPresent('DOCTOR_JWT_SECRET')
          ? 'pass'
          : 'fail',
      priority: 'P0',
    },
    {
      id: 'PR-SEC-02',
      domain: 'security',
      label: 'AI kill switch reachable',
      status: dashboard.systemHealth.aiGovernanceHydrated ? 'pass' : 'fail',
      priority: 'P0',
      ...(dashboard.ai.llmDisabled ? { detail: 'LLM currently disabled' } : {}),
    },
    {
      id: 'PR-OPS-01',
      domain: 'operations',
      label: 'Launch ownership — launch lead assigned',
      status: config.ownership.launchLead ? 'pass' : 'fail',
      priority: 'P0',
    },
    {
      id: 'PR-OPS-02',
      domain: 'operations',
      label: 'Launch ownership — SRE on-call assigned',
      status: config.ownership.sreOnCall ? 'pass' : 'fail',
      priority: 'P0',
    },
    {
      id: 'PR-OPS-03',
      domain: 'operations',
      label: 'Rollback authority assigned',
      status: config.ownership.rollbackAuthority ? 'pass' : 'fail',
      priority: 'P0',
    },
    {
      id: 'PR-OPS-04',
      domain: 'operations',
      label: 'Incident commander assigned',
      status: config.ownership.incidentCommander ? 'pass' : 'fail',
      priority: 'P1',
    },
    {
      id: 'PR-BIZ-01',
      domain: 'operations',
      label: 'Doctor supply for phase',
      status: dashboard.doctors.supplyOk ? 'pass' : 'fail',
      priority: 'P0',
      detail: `${dashboard.doctors.activeVerified}/${dashboard.doctors.minRequired} active doctors`,
    },
    {
      id: 'PR-PLT-01',
      domain: 'platform',
      label: 'OTP_MODE live',
      status: process.env.OTP_MODE?.trim() === 'live' ? 'pass' : 'warn',
      priority: 'P0',
    },
    {
      id: 'PR-CMP-01',
      domain: 'compliance',
      label: 'Closed beta disabled for GA',
      status: config.closedBetaDisabled ? 'pass' : 'warn',
      priority: 'P1',
    },
    {
      id: 'PR-SCL-01',
      domain: 'scaling',
      label: 'Weekly registration cap configured',
      status: config.weeklyRegistrationCap !== null ? 'pass' : 'warn',
      priority: 'P1',
    },
    {
      id: 'PR-SCL-02',
      domain: 'scaling',
      label: 'Redis enabled for rate limits',
      status: envPresent('REDIS_URL') || process.env.REDIS_ENABLED === 'true' ? 'pass' : 'warn',
      priority: 'P1',
    },
  ];

  const scores: GaReadinessScores = {
    technical: Math.round(
      (scoreFromChecks(checks, 'platform') + scoreFromChecks(checks, 'scaling')) / 2,
    ),
    operational: scoreFromChecks(checks, 'operations'),
    compliance: scoreFromChecks(checks, 'compliance'),
    security: scoreFromChecks(checks, 'security'),
    business: dashboard.doctors.supplyOk ? 75 : 45,
    overall: 0,
  };
  scores.overall = Math.round(
    scores.technical * 0.22 +
      scores.operational * 0.22 +
      scores.compliance * 0.18 +
      scores.security * 0.14 +
      scores.business * 0.14 +
      scoreFromChecks(checks, 'monitoring') * 0.1,
  );

  const derivedVerdict = deriveGoNoGoVerdict(config);
  const verdict =
    derivedVerdict === 'GO' && scores.overall < 85 ? 'GO_WITH_CONDITIONS' : derivedVerdict;

  return {
    generatedAt: new Date().toISOString(),
    verdict,
    scores,
    checks,
    checklistSummary,
    rolloutRecommendation: buildRolloutRecommendation(
      verdict,
      config.phase,
      dashboard.doctors.supplyOk,
    ),
  };
}
