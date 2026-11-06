import { DoctorTrackKind, ProviderStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import {
  BASE_TRACKS,
  baseTracksFrom,
  canApplyPetTrack,
  decideTrackTransition,
  speciesFocusFor,
  type DoctorTrackKey,
} from './doctor-tracks.rules.js';
import type { ReviewAction, ReviewProviderStatus } from './partner-review.rules.js';

export type PetApplication = {
  practiceName: string;
  practiceType: string;
  practiceAddress: string;
  practiceLicenseNo?: string | undefined;
  yearsPracticing?: number | undefined;
  monthlyCases?: number | undefined;
};

export type TrackView = {
  kind: DoctorTrackKey;
  status: ProviderStatus;
  reviewNote: string | null;
  needsCorrection: boolean;
  practiceName: string | null;
  practiceType: string | null;
  practiceAddress: string | null;
  practiceLicenseNo: string | null;
  yearsPracticing: number | null;
  monthlyCases: number | null;
};

export type TrackResult = { ok: true } | { ok: false; httpStatus: number; message: string };

export async function tracksOfDoctor(doctorProfileId: string): Promise<TrackView[]> {
  const rows = await getPrisma().doctorTrack.findMany({
    where: { doctorProfileId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((t) => ({
    kind: t.kind as DoctorTrackKey,
    status: t.status,
    reviewNote: t.reviewNote,
    needsCorrection: t.status === ProviderStatus.PENDING_VERIFICATION && !!t.reviewNote,
    practiceName: t.practiceName,
    practiceType: t.practiceType,
    practiceAddress: t.practiceAddress,
    practiceLicenseNo: t.practiceLicenseNo,
    yearsPracticing: t.yearsPracticing,
    monthlyCases: t.monthlyCases,
  }));
}

/** Creates the cattle/poultry tracks implied by the application (idempotent). */
export async function ensureBaseTracks(doctorProfileId: string, speciesFocus: readonly string[]) {
  const prisma = getPrisma();
  for (const kind of baseTracksFrom(speciesFocus)) {
    await prisma.doctorTrack.upsert({
      where: { doctorProfileId_kind: { doctorProfileId, kind: kind as DoctorTrackKind } },
      create: { doctorProfileId, kind: kind as DoctorTrackKind },
      update: {},
    });
  }
}

/** Keeps `DoctorProfile.speciesFocus` equal to the approved tracks. */
export async function syncSpeciesFocus(doctorProfileId: string) {
  const prisma = getPrisma();
  const tracks = await prisma.doctorTrack.findMany({
    where: { doctorProfileId },
    select: { kind: true, status: true },
  });
  await prisma.doctorProfile.update({
    where: { id: doctorProfileId },
    data: {
      speciesFocus: speciesFocusFor(
        tracks.map((t) => ({ kind: t.kind as DoctorTrackKey, status: t.status as ReviewProviderStatus })),
      ),
    },
  });
}

/** Doctor approved → their pending base tracks become active. */
export async function activateBaseTracks(doctorProfileId: string) {
  const prisma = getPrisma();
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    select: { speciesFocus: true },
  });
  if (!profile) return;
  await ensureBaseTracks(doctorProfileId, profile.speciesFocus);
  await prisma.doctorTrack.updateMany({
    where: {
      doctorProfileId,
      kind: { in: BASE_TRACKS as unknown as DoctorTrackKind[] },
      status: ProviderStatus.PENDING_VERIFICATION,
    },
    data: { status: ProviderStatus.ACTIVE, reviewNote: null, reviewedAt: new Date() },
  });
  await syncSpeciesFocus(doctorProfileId);
}

export async function applyPetTrack(userId: string, details: PetApplication): Promise<TrackResult> {
  const prisma = getPrisma();
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true, providerStatus: true },
  });
  if (!doctor) return { ok: false, httpStatus: 409, message: 'আগে ডাক্তার হিসেবে আবেদন করুন।' };

  const current = await prisma.doctorTrack.findUnique({
    where: { doctorProfileId_kind: { doctorProfileId: doctor.id, kind: DoctorTrackKind.PET } },
    select: { status: true, reviewNote: true },
  });
  const gate = canApplyPetTrack(doctor.providerStatus as ReviewProviderStatus, current);
  if (!gate.ok) return { ok: false, httpStatus: 409, message: gate.message };

  const fields = {
    practiceName: details.practiceName,
    practiceType: details.practiceType,
    practiceAddress: details.practiceAddress,
    practiceLicenseNo: details.practiceLicenseNo ?? null,
    yearsPracticing: details.yearsPracticing ?? null,
    monthlyCases: details.monthlyCases ?? null,
    status: ProviderStatus.PENDING_VERIFICATION,
    reviewNote: null,
    reviewedAt: null,
  };
  await prisma.doctorTrack.upsert({
    where: { doctorProfileId_kind: { doctorProfileId: doctor.id, kind: DoctorTrackKind.PET } },
    create: { doctorProfileId: doctor.id, kind: DoctorTrackKind.PET, ...fields },
    update: fields,
  });
  return { ok: true };
}

export async function decideTrack(input: {
  doctorProfileId: string;
  kind: DoctorTrackKey;
  action: ReviewAction;
  note?: string | undefined;
}): Promise<TrackResult> {
  const prisma = getPrisma();
  const track = await prisma.doctorTrack.findUnique({
    where: {
      doctorProfileId_kind: { doctorProfileId: input.doctorProfileId, kind: input.kind as DoctorTrackKind },
    },
    select: { id: true, status: true },
  });
  if (!track) return { ok: false, httpStatus: 404, message: 'ট্র্যাক পাওয়া যায়নি।' };

  const t = decideTrackTransition(track.status as ReviewProviderStatus, input.action);
  if (!t.ok) return { ok: false, httpStatus: 409, message: t.message };

  const clearNote = input.action === 'approve' || input.action === 'reactivate';
  await prisma.doctorTrack.update({
    where: { id: track.id },
    data: {
      status: t.status as ProviderStatus,
      reviewNote: clearNote ? null : input.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });
  await syncSpeciesFocus(input.doctorProfileId);
  return { ok: true };
}
