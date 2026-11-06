import { ProviderStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { tracksOfDoctor, type TrackView } from './doctor-tracks.service.js';
import { PARTNER_ROLES, grantedServiceRoles, type PartnerRole } from './partner-roles.js';

/** What the partner app needs to decide which screen to show after sign-in. */
export type PartnerAccountState =
  | 'NOT_APPLIED' // signed in, but no partner profile yet
  | 'PENDING' // submitted / under review
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export type PartnerProfileSummary = {
  role: PartnerRole;
  providerStatus: ProviderStatus;
  /** Extra lifecycle detail where the module has one (AI technician: DRAFT, SUBMITTED, …). */
  detailStatus: string | null;
  /** Admin feedback to show the partner (why rejected / what to fix). */
  reviewNote: string | null;
  reviewedAt: string | null;
  /** Admin asked for changes — the partner may edit and re-submit. */
  needsCorrection: boolean;
};

export type PartnerSummary = {
  user: { id: string; name: string; phone: string | null; email: string };
  primaryRole: PartnerRole | null;
  grantedServiceRoles: PartnerRole[];
  accountState: PartnerAccountState;
  profiles: PartnerProfileSummary[];
  /** Doctor practice tracks (empty for other roles). */
  tracks: TrackView[];
};

export function accountStateFor(status: ProviderStatus | null): PartnerAccountState {
  switch (status) {
    case null:
      return 'NOT_APPLIED';
    case ProviderStatus.ACTIVE:
      return 'APPROVED';
    case ProviderStatus.REJECTED:
      return 'REJECTED';
    case ProviderStatus.SUSPENDED:
      return 'SUSPENDED';
    default:
      return 'PENDING';
  }
}

/** Broadest existing profile wins (doctor > AI technician > health worker). */
export function primaryRoleOf(roles: PartnerRole[]): PartnerRole | null {
  return PARTNER_ROLES.find((r) => roles.includes(r)) ?? null;
}

export async function buildPartnerSummary(userId: string): Promise<PartnerSummary | null> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: {
      customerProfile: { select: { displayName: true } },
      doctorProfile: {
        select: { id: true, providerStatus: true, displayName: true, reviewNote: true, reviewedAt: true },
      },
      aiTechnicianProfile: {
        select: {
          providerStatus: true,
          status: true,
          displayName: true,
          adminNote: true,
          correctionNote: true,
          reviewedAt: true,
        },
      },
      healthWorkerProfile: {
        select: { providerStatus: true, displayName: true, reviewNote: true, reviewedAt: true },
      },
    },
  });
  if (!user) return null;

  const profiles: PartnerProfileSummary[] = [];
  if (user.doctorProfile) {
    profiles.push({
      role: 'DOCTOR',
      providerStatus: user.doctorProfile.providerStatus,
      detailStatus: null,
      reviewNote: user.doctorProfile.reviewNote,
      reviewedAt: user.doctorProfile.reviewedAt?.toISOString() ?? null,
      needsCorrection:
        user.doctorProfile.providerStatus === ProviderStatus.PENDING_VERIFICATION &&
        !!user.doctorProfile.reviewNote,
    });
  }
  if (user.aiTechnicianProfile) {
    profiles.push({
      role: 'AI_TECHNICIAN',
      providerStatus: user.aiTechnicianProfile.providerStatus,
      detailStatus: user.aiTechnicianProfile.status,
      reviewNote: user.aiTechnicianProfile.correctionNote ?? user.aiTechnicianProfile.adminNote,
      reviewedAt: user.aiTechnicianProfile.reviewedAt?.toISOString() ?? null,
      needsCorrection: user.aiTechnicianProfile.status === 'NEEDS_CORRECTION',
    });
  }
  if (user.healthWorkerProfile) {
    profiles.push({
      role: 'HEALTH_WORKER',
      providerStatus: user.healthWorkerProfile.providerStatus,
      detailStatus: null,
      reviewNote: user.healthWorkerProfile.reviewNote,
      reviewedAt: user.healthWorkerProfile.reviewedAt?.toISOString() ?? null,
      needsCorrection:
        user.healthWorkerProfile.providerStatus === ProviderStatus.PENDING_VERIFICATION &&
        !!user.healthWorkerProfile.reviewNote,
    });
  }

  const primary = primaryRoleOf(profiles.map((p) => p.role));
  const primaryProfile = profiles.find((p) => p.role === primary) ?? null;
  const name =
    user.doctorProfile?.displayName ??
    user.aiTechnicianProfile?.displayName ??
    user.healthWorkerProfile?.displayName ??
    user.customerProfile?.displayName ??
    '';

  return {
    user: { id: user.id, name, phone: user.phone, email: user.email },
    primaryRole: primary,
    grantedServiceRoles: primary ? grantedServiceRoles(primary) : [],
    accountState: accountStateFor(primaryProfile?.providerStatus ?? null),
    profiles,
    tracks: user.doctorProfile ? await tracksOfDoctor(user.doctorProfile.id) : [],
  };
}
