import { UserRole } from '../../generated/prisma/index.js';
import { normalizeBdMobilePhone } from '../../modules/auth/identity-core.js';
import { getClosedBetaConfig, saveClosedBetaConfig } from './closed-beta-config.service.js';
import type { BetaCohort, BetaDoctorTag, BetaParticipantTag } from './closed-beta.types.js';

export type ClosedBetaAccessResult =
  | { ok: true }
  | { ok: false; code: string; message: string; httpStatus: number };

export async function assertClosedBetaPhoneAccess(
  rawPhone: string,
): Promise<ClosedBetaAccessResult> {
  const config = await getClosedBetaConfig();
  if (!config.enabled) {
    return { ok: true };
  }

  const normalizedPhone = normalizeBdMobilePhone(rawPhone);
  if (!normalizedPhone) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Invalid phone number',
      httpStatus: 422,
    };
  }

  if (config.enforceInviteList) {
    const invited = config.invitedPhones.some(
      (p) => normalizeBdMobilePhone(p) === normalizedPhone,
    );
    if (!invited) {
      return {
        ok: false,
        code: 'CLOSED_BETA_INVITE_REQUIRED',
        message:
          'Prani Doctor is in closed beta. Your number is not on the invite list. Contact support for access.',
        httpStatus: 403,
      };
    }
  }

  if (config.enforceUserCap) {
    const prisma = (await import('../database/prisma.js')).getPrisma();
    const taggedCount = Object.keys(config.betaUserTags).length;
    const existingUser = await prisma.user.findFirst({
      where: { phone: normalizedPhone, role: UserRole.CUSTOMER },
      select: { id: true },
    });
    const alreadyTagged =
      existingUser !== null && config.betaUserTags[existingUser.id] !== undefined;

    if (!alreadyTagged && !existingUser && taggedCount >= config.maxUsers) {
      return {
        ok: false,
        code: 'CLOSED_BETA_USER_CAP',
        message: 'Closed beta is full. Please try again when public access opens.',
        httpStatus: 403,
      };
    }
  }

  return { ok: true };
}

export async function tagBetaUser(
  userId: string,
  cohort: BetaCohort,
  note?: string,
): Promise<BetaParticipantTag> {
  const config = await getClosedBetaConfig();
  const tag: BetaParticipantTag = {
    cohort,
    taggedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };
  config.betaUserTags[userId] = tag;
  await saveClosedBetaConfig(config);
  return tag;
}

export async function tagBetaDoctor(
  doctorProfileId: string,
  cohort: BetaCohort,
  options?: { note?: string; acceptsEmergency?: boolean },
): Promise<BetaDoctorTag> {
  const config = await getClosedBetaConfig();
  const tag: BetaDoctorTag = {
    cohort,
    taggedAt: new Date().toISOString(),
    ...(options?.note ? { note: options.note } : {}),
    ...(options?.acceptsEmergency !== undefined
      ? { acceptsEmergency: options.acceptsEmergency }
      : {}),
  };
  config.betaDoctorTags[doctorProfileId] = tag;
  await saveClosedBetaConfig(config);
  return tag;
}

export async function addInvitedPhone(rawPhone: string): Promise<string[]> {
  const normalized = normalizeBdMobilePhone(rawPhone);
  if (!normalized) {
    throw new Error('INVALID_PHONE');
  }
  const config = await getClosedBetaConfig();
  if (!config.invitedPhones.includes(normalized)) {
    config.invitedPhones = [...config.invitedPhones, normalized];
    await saveClosedBetaConfig(config);
  }
  return config.invitedPhones;
}

export async function autoTagUserOnFirstLogin(
  userId: string,
): Promise<BetaParticipantTag | null> {
  const config = await getClosedBetaConfig();
  if (!config.enabled) return null;
  if (config.betaUserTags[userId]) return config.betaUserTags[userId];

  const cohort = config.activeCohort === 'NONE' ? 'C1' : config.activeCohort;
  return tagBetaUser(userId, cohort, 'auto-tagged on first login');
}
