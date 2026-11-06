import { transitionFor, type ReviewAction, type ReviewProviderStatus } from './partner-review.rules.js';
import type { DocumentRequirement } from './partner-documents.rules.js';

export const DOCTOR_TRACKS = ['CATTLE_GOAT', 'POULTRY_DUCK', 'PET'] as const;
export type DoctorTrackKey = (typeof DOCTOR_TRACKS)[number];

/** Tracks approved together with the doctor's main application (no extra papers). */
export const BASE_TRACKS: readonly DoctorTrackKey[] = ['CATTLE_GOAT', 'POULTRY_DUCK'];

const SPECIES_BY_TRACK: Record<DoctorTrackKey, string> = {
  CATTLE_GOAT: 'cattle_goat',
  POULTRY_DUCK: 'poultry_duck',
  PET: 'pet',
};

export const TRACK_LABEL_BN: Record<DoctorTrackKey, string> = {
  CATTLE_GOAT: 'গরু-ছাগল',
  POULTRY_DUCK: 'হাঁস-মুরগি',
  PET: 'পোষা প্রাণী',
};

export function isTrackKey(v: unknown): v is DoctorTrackKey {
  return typeof v === 'string' && (DOCTOR_TRACKS as readonly string[]).includes(v);
}

export function trackForSpecies(species: string): DoctorTrackKey | null {
  return DOCTOR_TRACKS.find((t) => SPECIES_BY_TRACK[t] === species) ?? null;
}

/** Base tracks implied by the species chosen in the application (pet is always separate). */
export function baseTracksFrom(speciesFocus: readonly string[]): DoctorTrackKey[] {
  const out: DoctorTrackKey[] = [];
  for (const s of speciesFocus) {
    const t = trackForSpecies(s);
    if (t && BASE_TRACKS.includes(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/** `DoctorProfile.speciesFocus` mirrors the approved tracks so existing listings keep working. */
export function speciesFocusFor(tracks: readonly { kind: DoctorTrackKey; status: ReviewProviderStatus }[]): string[] {
  return DOCTOR_TRACKS.filter((k) => tracks.some((t) => t.kind === k && t.status === 'ACTIVE')).map(
    (k) => SPECIES_BY_TRACK[k],
  );
}

/** Extra documents a doctor must give for the pet track (experience + where they practise). */
export const PET_TRACK_DOCUMENTS: DocumentRequirement[] = [
  {
    type: 'PET_EXPERIENCE_CERTIFICATE',
    labelBn: 'পোষা প্রাণী চিকিৎসার অভিজ্ঞতার সনদ',
    hintBn: 'কোথায়/কতদিন পোষা প্রাণীর চিকিৎসা করেছেন তার প্রত্যয়নপত্র',
    required: true,
  },
  {
    type: 'PET_PRACTICE_PROOF',
    labelBn: 'প্র্যাকটিসের জায়গার প্রমাণ',
    hintBn: 'ট্রেড লাইসেন্স, ভাড়ার চুক্তি বা ক্লিনিকের নিবন্ধন',
    required: true,
  },
  {
    type: 'PET_CLINIC_PHOTO',
    labelBn: 'ক্লিনিক/চেম্বারের ছবি',
    hintBn: 'ভেতর ও বাইরের স্পষ্ট ছবি',
    required: false,
  },
];

export const PRACTICE_TYPES = ['CLINIC', 'HOSPITAL', 'HOME_BASED', 'OTHER'] as const;
export const PRACTICE_TYPE_BN: Record<(typeof PRACTICE_TYPES)[number], string> = {
  CLINIC: 'ক্লিনিক',
  HOSPITAL: 'পোষা প্রাণীর হাসপাতাল',
  HOME_BASED: 'বাসা/চেম্বার',
  OTHER: 'অন্যান্য',
};

/** Whether a doctor may (re-)apply for the pet track given the current track state. */
export function canApplyPetTrack(
  doctorStatus: ReviewProviderStatus,
  current: { status: ReviewProviderStatus; reviewNote: string | null } | null,
): { ok: true } | { ok: false; message: string } {
  if (doctorStatus !== 'ACTIVE') {
    return { ok: false, message: 'আগে ডাক্তার হিসেবে আপনার আবেদন অনুমোদিত হতে হবে।' };
  }
  if (!current) return { ok: true };
  if (current.status === 'ACTIVE') return { ok: false, message: 'পোষা প্রাণীর অনুমোদন আগেই আছে।' };
  if (current.status === 'SUSPENDED') return { ok: false, message: 'এই ট্র্যাক স্থগিত। সহায়তা কেন্দ্রে জানান।' };
  if (current.status === 'PENDING_VERIFICATION' && !current.reviewNote) {
    return { ok: false, message: 'আপনার আবেদন যাচাই চলছে।' };
  }
  return { ok: true };
}

export function decideTrackTransition(status: ReviewProviderStatus, action: ReviewAction) {
  return transitionFor(status, action);
}
