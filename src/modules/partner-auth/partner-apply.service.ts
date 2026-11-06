import { AiTechnicianStatus, ProviderStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

import { ensureBaseTracks } from './doctor-tracks.service.js';
import { decideApply, type ApplyBlockCode } from './partner-apply.rules.js';
import type { PartnerRole } from './partner-roles.js';
import { buildPartnerSummary, type PartnerSummary } from './partner-summary.js';

/** Pet practice is applied for separately (own details, papers and approval). */
export type SpeciesFocus = 'cattle_goat' | 'poultry_duck';

export type PartnerApplication =
  | {
      role: 'DOCTOR';
      licenseNumber: string;
      degree: string;
      specialization?: string | undefined;
      experienceYears?: number | undefined;
      bio?: string | undefined;
      speciesFocus: SpeciesFocus[];
    }
  | {
      role: 'AI_TECHNICIAN';
      trainingProvider: string;
      certificateNumber: string;
      experienceYears?: number | undefined;
      bio?: string | undefined;
    }
  | {
      role: 'HEALTH_WORKER';
      certification: string;
      experienceYears?: number | undefined;
      bio?: string | undefined;
    };

export type ApplyResult =
  | { ok: true; summary: PartnerSummary }
  | { ok: false; httpStatus: number; code: ApplyBlockCode | 'NOT_FOUND'; message: string };

/** Creates or re-submits the partner profile for the signed-in user; always ends in "pending review". */
export async function applyForPartnerRole(
  userId: string,
  application: PartnerApplication,
): Promise<ApplyResult> {
  const before = await buildPartnerSummary(userId);
  if (!before) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'অ্যাকাউন্ট পাওয়া যায়নি।' };

  const decision = decideApply(
    before.profiles.map((p) => ({
      role: p.role,
      providerStatus: p.providerStatus,
      needsCorrection: p.needsCorrection,
    })),
    application.role as PartnerRole,
  );
  if (!decision.ok) {
    return { ok: false, httpStatus: 409, code: decision.code, message: decision.message };
  }

  const prisma = getPrisma();
  const displayName = before.user.name || undefined;
  const pending = ProviderStatus.PENDING_VERIFICATION;

  switch (application.role) {
    case 'DOCTOR': {
      const fields = {
        licenseNumber: application.licenseNumber,
        degree: application.degree,
        speciesFocus: application.speciesFocus,
        ...omitUndefined({
          specialization: application.specialization,
          experienceYears: application.experienceYears,
          bio: application.bio,
        }),
      };
      const doctor = await prisma.doctorProfile.upsert({
        where: { userId },
        create: { userId, providerStatus: pending, ...fields, ...omitUndefined({ displayName }) },
        update: { providerStatus: pending, reviewNote: null, reviewedAt: null, ...fields },
        select: { id: true },
      });
      await ensureBaseTracks(doctor.id, application.speciesFocus);
      break;
    }
    case 'AI_TECHNICIAN': {
      const fields = {
        trainingProvider: application.trainingProvider,
        certificateNumber: application.certificateNumber,
        ...omitUndefined({ experienceYears: application.experienceYears, bio: application.bio }),
      };
      await prisma.aiTechnicianProfile.upsert({
        where: { userId },
        create: {
          userId,
          providerStatus: pending,
          status: AiTechnicianStatus.SUBMITTED,
          ...fields,
          ...omitUndefined({ displayName }),
        },
        update: {
          providerStatus: pending,
          status: AiTechnicianStatus.SUBMITTED,
          correctionNote: null,
          ...fields,
        },
      });
      break;
    }
    case 'HEALTH_WORKER': {
      const fields = {
        certification: application.certification,
        ...omitUndefined({ experienceYears: application.experienceYears, bio: application.bio }),
      };
      await prisma.healthWorkerProfile.upsert({
        where: { userId },
        create: { userId, providerStatus: pending, ...fields, ...omitUndefined({ displayName }) },
        update: { providerStatus: pending, reviewNote: null, reviewedAt: null, ...fields },
      });
      break;
    }
  }

  const summary = await buildPartnerSummary(userId);
  if (!summary) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'অ্যাকাউন্ট পাওয়া যায়নি।' };
  return { ok: true, summary };
}
