import {
  AiTechnicianStatus,
  ProviderStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import {
  bucketOf,
  promotedUserRole,
  transitionFor,
  type ReviewAction,
  type ReviewBucket,
} from './partner-review.rules.js';
import { activateBaseTracks, tracksOfDoctor, type TrackView } from './doctor-tracks.service.js';
import { documentsForUserRole, type DocumentView } from './partner-documents.service.js';
import type { ChecklistItem } from './partner-documents.rules.js';
import type { PartnerRole } from './partner-roles.js';

export type ReviewRow = {
  id: string;
  role: PartnerRole;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  providerStatus: ProviderStatus;
  bucket: ReviewBucket;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  details: { label: string; value: string }[];
};

export type ReviewListQuery = {
  role?: PartnerRole | undefined;
  bucket?: ReviewBucket | undefined;
  q?: string | undefined;
  id?: string | undefined;
  /** Doctors whose pet track awaits a decision. */
  petPending?: boolean | undefined;
  limit: number;
  offset: number;
};

export type ReviewList = {
  rows: ReviewRow[];
  total: number;
  /** Open (pending + correction) applications per role, for tab badges. */
  pendingCounts: Record<PartnerRole, number>;
};

type Where = Record<string, unknown>;

function statusWhere(bucket: ReviewBucket | undefined, role: PartnerRole): Where {
  const correction = role === 'AI_TECHNICIAN' ? { status: AiTechnicianStatus.NEEDS_CORRECTION } : null;
  const pending = ProviderStatus.PENDING_VERIFICATION;
  switch (bucket) {
    case 'ACTIVE':
      return { providerStatus: ProviderStatus.ACTIVE };
    case 'REJECTED':
      return { providerStatus: ProviderStatus.REJECTED };
    case 'SUSPENDED':
      return { providerStatus: ProviderStatus.SUSPENDED };
    case 'CORRECTION':
      return correction
        ? { providerStatus: pending, ...correction }
        : { providerStatus: pending, reviewNote: { not: null } };
    case 'PENDING':
      return correction
        ? { providerStatus: pending, status: { not: AiTechnicianStatus.NEEDS_CORRECTION } }
        : { providerStatus: pending, reviewNote: null };
    default:
      return {};
  }
}

function userSearch(q: string | undefined, nameField: boolean): Where {
  if (!q) return {};
  const like = { contains: q, mode: 'insensitive' as const };
  return {
    OR: [
      { user: { email: like } },
      { user: { phone: like } },
      ...(nameField ? [{ displayName: like }] : []),
    ],
  };
}

function d(label: string, value: unknown): { label: string; value: string } | null {
  if (value === null || value === undefined) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return text.trim() ? { label, value: text.trim() } : null;
}

const userSelect = {
  select: {
    id: true,
    email: true,
    phone: true,
    customerProfile: { select: { displayName: true } },
  },
} as const;

type UserLite = {
  id: string;
  email: string;
  phone: string | null;
  customerProfile: { displayName: string | null } | null;
};

function base(
  role: PartnerRole,
  p: {
    id: string;
    providerStatus: ProviderStatus;
    displayName: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  },
  user: UserLite,
  needsCorrection: boolean,
  note: string | null,
  details: ({ label: string; value: string } | null)[],
): ReviewRow {
  return {
    id: p.id,
    role,
    userId: user.id,
    name: p.displayName || user.customerProfile?.displayName || user.email,
    email: user.email,
    phone: user.phone,
    providerStatus: p.providerStatus,
    bucket: bucketOf(p.providerStatus, needsCorrection),
    reviewNote: note,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    submittedAt: p.createdAt.toISOString(),
    details: details.filter((x): x is { label: string; value: string } => x !== null),
  };
}

async function fetchRole(role: PartnerRole, q: ReviewListQuery, take: number) {
  const prisma = getPrisma();
  const where = {
    ...statusWhere(q.bucket, role),
    ...userSearch(q.q, true),
    ...(q.id ? { id: q.id } : {}),
    ...(role === 'DOCTOR' && q.petPending
      ? { tracks: { some: { kind: 'PET', status: ProviderStatus.PENDING_VERIFICATION } } }
      : {}),
  };
  const args = { where, orderBy: { createdAt: 'desc' as const }, take };
  if (role === 'DOCTOR') {
    const [items, count] = await Promise.all([
      prisma.doctorProfile.findMany({ ...args, include: { user: userSelect } }),
      prisma.doctorProfile.count({ where }),
    ]);
    return {
      count,
      rows: items.map((p) =>
        base(role, p, p.user, p.providerStatus === ProviderStatus.PENDING_VERIFICATION && !!p.reviewNote, p.reviewNote, [
          d('বিভিসি/লাইসেন্স নম্বর', p.licenseNumber),
          d('ডিগ্রি', p.degree),
          d('বিশেষত্ব', p.specialization),
          d('প্রাণীর ধরন', p.speciesFocus),
          d('অভিজ্ঞতা (বছর)', p.experienceYears),
          d('পরিচিতি', p.bio),
        ]),
      ),
    };
  }
  if (role === 'AI_TECHNICIAN') {
    const [items, count] = await Promise.all([
      prisma.aiTechnicianProfile.findMany({ ...args, include: { user: userSelect } }),
      prisma.aiTechnicianProfile.count({ where }),
    ]);
    return {
      count,
      rows: items.map((p) =>
        base(
          role,
          p,
          p.user,
          p.status === AiTechnicianStatus.NEEDS_CORRECTION,
          p.correctionNote ?? p.adminNote,
          [
            d('প্রশিক্ষণ প্রতিষ্ঠান', p.trainingProvider),
            d('সনদ নম্বর', p.certificateNumber),
            d('সনদ', p.certification),
            d('অভিজ্ঞতা (বছর)', p.experienceYears),
            d('পরিচিতি', p.bio),
          ],
        ),
      ),
    };
  }
  const [items, count] = await Promise.all([
    prisma.healthWorkerProfile.findMany({ ...args, include: { user: userSelect } }),
    prisma.healthWorkerProfile.count({ where }),
  ]);
  return {
    count,
    rows: items.map((p) =>
      base(role, p, p.user, p.providerStatus === ProviderStatus.PENDING_VERIFICATION && !!p.reviewNote, p.reviewNote, [
        d('প্রশিক্ষণ/সনদ', p.certification),
        d('অভিজ্ঞতা (বছর)', p.experienceYears),
        d('পরিচিতি', p.bio),
      ]),
    ),
  };
}

export async function listPartnerApplications(q: ReviewListQuery): Promise<ReviewList> {
  const prisma = getPrisma();
  const roles: PartnerRole[] = q.petPending
    ? ['DOCTOR']
    : q.role
      ? [q.role]
      : ['DOCTOR', 'AI_TECHNICIAN', 'HEALTH_WORKER'];
  const parts = await Promise.all(roles.map((r) => fetchRole(r, q, q.offset + q.limit)));
  const rows = parts
    .flatMap((p) => p.rows)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(q.offset, q.offset + q.limit);

  const open = ProviderStatus.PENDING_VERIFICATION;
  const [doctor, ai, hw] = await Promise.all([
    prisma.doctorProfile.count({ where: { providerStatus: open } }),
    prisma.aiTechnicianProfile.count({ where: { providerStatus: open } }),
    prisma.healthWorkerProfile.count({ where: { providerStatus: open } }),
  ]);
  return {
    rows,
    total: parts.reduce((n, p) => n + p.count, 0),
    pendingCounts: { DOCTOR: doctor, AI_TECHNICIAN: ai, HEALTH_WORKER: hw },
  };
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; httpStatus: number; message: string };

export async function decidePartnerApplication(input: {
  role: PartnerRole;
  profileId: string;
  action: ReviewAction;
  note?: string | undefined;
  adminUserId?: string | undefined;
}): Promise<DecisionResult> {
  const prisma = getPrisma();
  const { role, profileId, action } = input;
  const note = input.note?.trim() || null;

  const current =
    role === 'DOCTOR'
      ? await prisma.doctorProfile.findUnique({
          where: { id: profileId },
          select: { userId: true, providerStatus: true },
        })
      : role === 'AI_TECHNICIAN'
        ? await prisma.aiTechnicianProfile.findUnique({
            where: { id: profileId },
            select: { userId: true, providerStatus: true },
          })
        : await prisma.healthWorkerProfile.findUnique({
            where: { id: profileId },
            select: { userId: true, providerStatus: true },
          });
  if (!current) return { ok: false, httpStatus: 404, message: 'আবেদন পাওয়া যায়নি।' };

  const t = transitionFor(current.providerStatus, action);
  if (!t.ok) return { ok: false, httpStatus: 409, message: t.message };

  const now = new Date();
  const approved = t.status === 'ACTIVE';
  const feedback = action === 'approve' || action === 'reactivate' ? null : note;

  await prisma.$transaction(async (tx) => {
    if (role === 'DOCTOR') {
      await tx.doctorProfile.update({
        where: { id: profileId },
        data: {
          providerStatus: t.status,
          reviewNote: feedback,
          reviewedAt: now,
          ...(approved ? { verifiedAt: now } : {}),
        },
      });
    } else if (role === 'AI_TECHNICIAN') {
      await tx.aiTechnicianProfile.update({
        where: { id: profileId },
        data: {
          providerStatus: t.status,
          reviewedAt: now,
          ...(input.adminUserId ? { reviewedById: input.adminUserId } : {}),
          correctionNote: t.needsCorrection ? feedback : null,
          adminNote: feedback,
          status: t.needsCorrection
            ? AiTechnicianStatus.NEEDS_CORRECTION
            : t.status === 'ACTIVE'
              ? AiTechnicianStatus.APPROVED
              : t.status === 'REJECTED'
                ? AiTechnicianStatus.REJECTED
                : t.status === 'SUSPENDED'
                  ? AiTechnicianStatus.SUSPENDED
                  : AiTechnicianStatus.UNDER_REVIEW,
          ...(approved ? { verifiedAt: now } : {}),
        },
      });
    } else {
      await tx.healthWorkerProfile.update({
        where: { id: profileId },
        data: {
          providerStatus: t.status,
          reviewNote: feedback,
          reviewedAt: now,
          ...(approved ? { verifiedAt: now } : {}),
        },
      });
    }

    if (approved) {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: current.userId },
        select: { role: true },
      });
      const promoted = promotedUserRole(role);
      await tx.user.update({
        where: { id: current.userId },
        data: {
          status: UserStatus.ACTIVE,
          ...(promoted && user.role === UserRole.CUSTOMER ? { role: UserRole[promoted] } : {}),
        },
      });
    }
  });
  if (role === 'DOCTOR' && approved) await activateBaseTracks(profileId);
  return { ok: true };
}

export type LegacyDocument = {
  id: string;
  type: string;
  title: string;
  reviewStatus: string;
  fileId: string;
  mimeType: string | null;
};

export type ApplicationDetail = {
  row: ReviewRow;
  documents: DocumentView[];
  checklist: ChecklistItem[];
  /** Documents the AI technician uploaded through the older application flow (read-only). */
  legacyDocuments: LegacyDocument[];
  /** Doctor practice tracks (cattle/goat, poultry/duck, pet). */
  tracks: TrackView[];
};

export async function getPartnerApplicationDetail(
  role: PartnerRole,
  profileId: string,
): Promise<ApplicationDetail | null> {
  const part = await fetchRole(role, { id: profileId, limit: 1, offset: 0 }, 1);
  const row = part.rows[0];
  if (!row) return null;
  const { documents, checklist } = await documentsForUserRole(row.userId, role);

  let legacyDocuments: LegacyDocument[] = [];
  if (role === 'AI_TECHNICIAN') {
    const legacy = await getPrisma().aiTechnicianDocument.findMany({
      where: { aiTechnicianId: profileId, uploadedFileId: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: { uploadedFile: { select: { id: true, mimeType: true } } },
    });
    legacyDocuments = legacy.flatMap((l) =>
      l.uploadedFile
        ? [
            {
              id: l.id,
              type: l.type,
              title: l.title,
              reviewStatus: l.reviewStatus,
              fileId: l.uploadedFile.id,
              mimeType: l.uploadedFile.mimeType,
            },
          ]
        : [],
    );
  }
  const tracks = role === 'DOCTOR' ? await tracksOfDoctor(profileId) : [];
  return { row, documents, checklist, legacyDocuments, tracks };
}
