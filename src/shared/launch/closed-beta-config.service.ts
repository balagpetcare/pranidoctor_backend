import { getPrisma } from '../database/prisma.js';
import { isProduction } from '../config/index.js';
import {
  CLOSED_BETA_SETTING_KEY,
  DEFAULT_CLOSED_BETA_CONFIG,
  type BetaCohort,
  type BetaDoctorTag,
  type BetaParticipantTag,
  type ClosedBetaConfig,
  type ClosedBetaPublicStatus,
} from './closed-beta.types.js';

function readEnvBool(name: string): boolean | null {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return null;
}

function parseCohort(value: unknown): BetaCohort {
  const allowed: BetaCohort[] = ['C0', 'C1', 'C2', 'C3', 'C4', 'NONE'];
  if (typeof value === 'string' && (allowed as string[]).includes(value)) {
    return value as BetaCohort;
  }
  return 'NONE';
}

function parseTagMap<T extends BetaParticipantTag>(
  value: unknown,
): Record<string, T> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, T> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.taggedAt !== 'string') continue;
    const cohort = parseCohort(o.cohort);
    out[key] = {
      cohort,
      taggedAt: o.taggedAt,
      ...(typeof o.note === 'string' ? { note: o.note } : {}),
      ...(typeof o.acceptsEmergency === 'boolean'
        ? { acceptsEmergency: o.acceptsEmergency }
        : {}),
    } as T;
  }
  return out;
}

export function parseClosedBetaConfig(raw: unknown): ClosedBetaConfig {
  const base = { ...DEFAULT_CLOSED_BETA_CONFIG };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return applyEnvOverrides(base);
  }
  const o = raw as Record<string, unknown>;
  const monitoring =
    o.monitoringLinks !== null &&
    typeof o.monitoringLinks === 'object' &&
    !Array.isArray(o.monitoringLinks)
      ? (o.monitoringLinks as ClosedBetaConfig['monitoringLinks'])
      : base.monitoringLinks;

  const betaBanner =
    o.betaBanner !== null &&
    typeof o.betaBanner === 'object' &&
    !Array.isArray(o.betaBanner)
      ? (o.betaBanner as ClosedBetaConfig['betaBanner'])
      : base.betaBanner;

  return applyEnvOverrides({
    enabled: typeof o.enabled === 'boolean' ? o.enabled : base.enabled,
    enforceInviteList:
      typeof o.enforceInviteList === 'boolean'
        ? o.enforceInviteList
        : base.enforceInviteList,
    enforceUserCap:
      typeof o.enforceUserCap === 'boolean' ? o.enforceUserCap : base.enforceUserCap,
    maxUsers: typeof o.maxUsers === 'number' ? o.maxUsers : base.maxUsers,
    maxDoctors: typeof o.maxDoctors === 'number' ? o.maxDoctors : base.maxDoctors,
    activeCohort: parseCohort(o.activeCohort ?? base.activeCohort),
    invitedPhones: Array.isArray(o.invitedPhones)
      ? o.invitedPhones.filter((p): p is string => typeof p === 'string')
      : base.invitedPhones,
    betaUserTags: parseTagMap<BetaParticipantTag>(o.betaUserTags),
    betaDoctorTags: parseTagMap<BetaDoctorTag>(o.betaDoctorTags),
    pilotAreaIds: Array.isArray(o.pilotAreaIds)
      ? o.pilotAreaIds.filter((id): id is string => typeof id === 'string')
      : base.pilotAreaIds,
    feedbackEnabled:
      typeof o.feedbackEnabled === 'boolean' ? o.feedbackEnabled : base.feedbackEnabled,
    betaBanner,
    doctorSupportWhatsapp:
      typeof o.doctorSupportWhatsapp === 'string'
        ? o.doctorSupportWhatsapp
        : base.doctorSupportWhatsapp,
    userSupportWhatsapp:
      typeof o.userSupportWhatsapp === 'string'
        ? o.userSupportWhatsapp
        : base.userSupportWhatsapp,
    monitoringLinks: monitoring,
    contentVersion:
      typeof o.contentVersion === 'string' ? o.contentVersion : base.contentVersion,
  });
}

function applyEnvOverrides(config: ClosedBetaConfig): ClosedBetaConfig {
  const envEnabled = readEnvBool('CLOSED_BETA_ENABLED');
  const envEnforceInvite = readEnvBool('CLOSED_BETA_ENFORCE_INVITE');
  return {
    ...config,
    ...(envEnabled !== null ? { enabled: envEnabled } : {}),
    ...(envEnforceInvite !== null ? { enforceInviteList: envEnforceInvite } : {}),
  };
}

export async function getClosedBetaConfig(): Promise<ClosedBetaConfig> {
  try {
    const row = await getPrisma().setting.findUnique({
      where: { key: CLOSED_BETA_SETTING_KEY },
      select: { valueJson: true },
    });
    return parseClosedBetaConfig(row?.valueJson ?? null);
  } catch {
    return applyEnvOverrides({ ...DEFAULT_CLOSED_BETA_CONFIG });
  }
}

export async function saveClosedBetaConfig(
  config: ClosedBetaConfig,
): Promise<ClosedBetaConfig> {
  const parsed = parseClosedBetaConfig(config);
  await getPrisma().setting.upsert({
    where: { key: CLOSED_BETA_SETTING_KEY },
    create: { key: CLOSED_BETA_SETTING_KEY, valueJson: parsed },
    update: { valueJson: parsed },
  });
  return parsed;
}

export function toPublicBetaStatus(config: ClosedBetaConfig): ClosedBetaPublicStatus {
  return {
    enabled: config.enabled,
    feedbackEnabled: config.feedbackEnabled,
    betaBanner: config.betaBanner,
    activeCohort: config.activeCohort,
    supportWhatsapp: config.userSupportWhatsapp,
  };
}

export function isClosedBetaProductionGuard(config: ClosedBetaConfig): boolean {
  return isProduction() && config.enabled;
}
