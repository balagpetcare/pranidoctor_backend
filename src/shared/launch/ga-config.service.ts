import { getPrisma } from '../database/prisma.js';
import {
  DEFAULT_GA_LAUNCH_CONFIG,
  GA_LAUNCH_SETTING_KEY,
  type GaChecklistItem,
  type GaChecklistItemStatus,
  type GaChecklistPriority,
  type GaLaunchConfig,
  type GaLaunchOwnership,
  type GaLaunchPhase,
  type GoNoGoVerdict,
} from './ga-launch.types.js';
import { buildDefaultGaChecklist } from './ga-default-checklist.js';
import { omitUndefined } from '../types/object.utils.js';

function readEnvBool(name: string): boolean | null {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return null;
}

function parsePhase(value: unknown): GaLaunchPhase {
  const allowed: GaLaunchPhase[] = [
    'PRE_GA',
    'SOFT_LAUNCH',
    'GRADUAL_ROLLOUT',
    'FULL_LAUNCH',
    'PAUSED',
  ];
  if (typeof value === 'string' && (allowed as string[]).includes(value)) {
    return value as GaLaunchPhase;
  }
  return 'PRE_GA';
}

function parseVerdict(value: unknown): GoNoGoVerdict {
  const allowed: GoNoGoVerdict[] = ['NO_GO', 'GO_WITH_CONDITIONS', 'GO'];
  if (typeof value === 'string' && (allowed as string[]).includes(value)) {
    return value as GoNoGoVerdict;
  }
  return 'NO_GO';
}

function parseChecklist(value: unknown): GaChecklistItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    return buildDefaultGaChecklist();
  }
  const allowedStatus: GaChecklistItemStatus[] = ['open', 'pass', 'fail', 'waived'];
  const allowedPriority: GaChecklistPriority[] = ['P0', 'P1', 'P2', 'P3'];
  const out: GaChecklistItem[] = [];
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue;
    const status =
      typeof o.status === 'string' && (allowedStatus as string[]).includes(o.status)
        ? (o.status as GaChecklistItemStatus)
        : 'open';
    const priority =
      typeof o.priority === 'string' && (allowedPriority as string[]).includes(o.priority)
        ? (o.priority as GaChecklistPriority)
        : 'P1';
    out.push({
      id: o.id,
      label: o.label,
      priority,
      status,
      ...(typeof o.owner === 'string' ? { owner: o.owner } : {}),
      ...(typeof o.evidence === 'string' ? { evidence: o.evidence } : {}),
      ...(typeof o.updatedAt === 'string' ? { updatedAt: o.updatedAt } : {}),
    });
  }
  return out.length > 0 ? out : buildDefaultGaChecklist();
}

function parseOwnership(value: unknown): GaLaunchOwnership {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const o = value as Record<string, unknown>;
  const pick = (key: keyof GaLaunchOwnership) =>
    typeof o[key] === 'string' ? (o[key] as string) : undefined;
  return omitUndefined({
    launchLead: pick('launchLead'),
    sreOnCall: pick('sreOnCall'),
    rollbackAuthority: pick('rollbackAuthority'),
    incidentCommander: pick('incidentCommander'),
    aiSafetyOwner: pick('aiSafetyOwner'),
    legalLiaison: pick('legalLiaison'),
    productOps: pick('productOps'),
  });
}

export function parseGaLaunchConfig(raw: unknown): GaLaunchConfig {
  const base = { ...DEFAULT_GA_LAUNCH_CONFIG, gateChecklist: buildDefaultGaChecklist() };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return applyEnvOverrides(base);
  }
  const o = raw as Record<string, unknown>;
  const monitoring =
    o.monitoringLinks !== null &&
    typeof o.monitoringLinks === 'object' &&
    !Array.isArray(o.monitoringLinks)
      ? (o.monitoringLinks as GaLaunchConfig['monitoringLinks'])
      : base.monitoringLinks;

  return applyEnvOverrides({
    enabled: typeof o.enabled === 'boolean' ? o.enabled : base.enabled,
    phase: parsePhase(o.phase ?? base.phase),
    goNoGoVerdict: parseVerdict(o.goNoGoVerdict ?? base.goNoGoVerdict),
    playRolloutPct:
      typeof o.playRolloutPct === 'number'
        ? Math.min(100, Math.max(0, o.playRolloutPct))
        : base.playRolloutPct,
    weeklyRegistrationCap:
      o.weeklyRegistrationCap === null
        ? null
        : typeof o.weeklyRegistrationCap === 'number'
          ? o.weeklyRegistrationCap
          : base.weeklyRegistrationCap,
    minDoctorsForPhase:
      typeof o.minDoctorsForPhase === 'number'
        ? o.minDoctorsForPhase
        : base.minDoctorsForPhase,
    targetDistrictIds: Array.isArray(o.targetDistrictIds)
      ? o.targetDistrictIds.filter((id): id is string => typeof id === 'string')
      : base.targetDistrictIds,
    closedBetaDisabled:
      typeof o.closedBetaDisabled === 'boolean'
        ? o.closedBetaDisabled
        : base.closedBetaDisabled,
    ownership: parseOwnership(o.ownership),
    monitoringLinks: monitoring,
    gateChecklist: parseChecklist(o.gateChecklist),
    lastGateReviewAt:
      typeof o.lastGateReviewAt === 'string' ? o.lastGateReviewAt : base.lastGateReviewAt,
    lastGateReviewBy:
      typeof o.lastGateReviewBy === 'string' ? o.lastGateReviewBy : base.lastGateReviewBy,
    contentVersion:
      typeof o.contentVersion === 'string' ? o.contentVersion : base.contentVersion,
  });
}

function applyEnvOverrides(config: GaLaunchConfig): GaLaunchConfig {
  const envEnabled = readEnvBool('GA_LAUNCH_ENABLED');
  const envPhase = process.env.GA_LAUNCH_PHASE?.trim();
  const phases: GaLaunchPhase[] = [
    'PRE_GA',
    'SOFT_LAUNCH',
    'GRADUAL_ROLLOUT',
    'FULL_LAUNCH',
    'PAUSED',
  ];
  return {
    ...config,
    ...(envEnabled !== null ? { enabled: envEnabled } : {}),
    ...(envPhase && (phases as string[]).includes(envPhase)
      ? { phase: envPhase as GaLaunchPhase }
      : {}),
  };
}

export async function getGaLaunchConfig(): Promise<GaLaunchConfig> {
  try {
    const row = await getPrisma().setting.findUnique({
      where: { key: GA_LAUNCH_SETTING_KEY },
      select: { valueJson: true },
    });
    return parseGaLaunchConfig(row?.valueJson ?? null);
  } catch {
    return applyEnvOverrides({
      ...DEFAULT_GA_LAUNCH_CONFIG,
      gateChecklist: buildDefaultGaChecklist(),
    });
  }
}

export async function saveGaLaunchConfig(config: GaLaunchConfig): Promise<GaLaunchConfig> {
  const parsed = parseGaLaunchConfig(config);
  await getPrisma().setting.upsert({
    where: { key: GA_LAUNCH_SETTING_KEY },
    create: { key: GA_LAUNCH_SETTING_KEY, valueJson: parsed },
    update: { valueJson: parsed },
  });
  return parsed;
}

export function summarizeChecklist(config: GaLaunchConfig) {
  const items = config.gateChecklist;
  return {
    total: items.length,
    pass: items.filter((i) => i.status === 'pass').length,
    fail: items.filter((i) => i.status === 'fail').length,
    open: items.filter((i) => i.status === 'open').length,
    waived: items.filter((i) => i.status === 'waived').length,
    p0Open: items.filter((i) => i.priority === 'P0' && i.status === 'open').length,
  };
}

export function deriveGoNoGoVerdict(config: GaLaunchConfig): GoNoGoVerdict {
  const summary = summarizeChecklist(config);
  if (summary.p0Open > 0 || summary.fail > 0) {
    return 'NO_GO';
  }
  const p0Total = config.gateChecklist.filter((i) => i.priority === 'P0').length;
  const p0Pass = config.gateChecklist.filter(
    (i) => i.priority === 'P0' && (i.status === 'pass' || i.status === 'waived'),
  ).length;
  if (p0Pass >= p0Total && summary.open === 0) {
    return 'GO';
  }
  if (p0Pass >= p0Total * 0.95) {
    return 'GO_WITH_CONDITIONS';
  }
  return config.goNoGoVerdict;
}
