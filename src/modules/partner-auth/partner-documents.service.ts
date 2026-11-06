import {
  MobileUploadPurpose,
  PartnerApplicantRole,
  PartnerDocumentReviewStatus,
  PartnerDocumentType,
  UploadedFileStatus,
} from '../../generated/prisma/index.js';
import { uploadFile } from '../../legacy/web/lib/storage/storage-module.js';
import { getPrisma } from '../../shared/database/prisma.js';

import {
  PARTNER_DOCUMENT_TYPES,
  buildChecklist,
  isTypeAllowedFor,
  outstandingRequired,
  type ChecklistItem,
  type PartnerDocumentTypeKey,
} from './partner-documents.rules.js';
import { PET_TRACK_DOCUMENTS } from './doctor-tracks.rules.js';
import type { PartnerRole } from './partner-roles.js';
import { buildPartnerSummary } from './partner-summary.js';

export type DocumentView = {
  id: string;
  type: PartnerDocumentTypeKey;
  title: string | null;
  reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
  fileId: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

export type RoleDocuments = {
  role: PartnerRole;
  providerStatus: string;
  checklist: ChecklistItem[];
  outstandingRequired: PartnerDocumentTypeKey[];
  documents: DocumentView[];
};

export function isDocumentType(v: unknown): v is PartnerDocumentTypeKey {
  return typeof v === 'string' && (PARTNER_DOCUMENT_TYPES as readonly string[]).includes(v);
}

/** Pet-track papers are asked only once the doctor has a pet track. */
async function extrasFor(userId: string, role: PartnerRole) {
  if (role !== 'DOCTOR') return [];
  const pet = await getPrisma().doctorTrack.findFirst({
    where: { kind: 'PET', doctorProfile: { userId } },
    select: { id: true },
  });
  return pet ? PET_TRACK_DOCUMENTS : [];
}

export async function documentsForUserRole(userId: string, role: PartnerRole): Promise<{
  documents: DocumentView[];
  checklist: ChecklistItem[];
}> {
  const rows = await getPrisma().partnerDocument.findMany({
    where: { userId, role: role as PartnerApplicantRole },
    orderBy: { createdAt: 'desc' },
    include: { uploadedFile: { select: { id: true, mimeType: true, sizeBytes: true, originalName: true } } },
  });
  const documents: DocumentView[] = rows.map((r) => ({
    id: r.id,
    type: r.type as PartnerDocumentTypeKey,
    title: r.title,
    reviewStatus: r.reviewStatus,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
    fileId: r.uploadedFile.id,
    mimeType: r.uploadedFile.mimeType,
    sizeBytes: r.uploadedFile.sizeBytes,
    originalName: r.uploadedFile.originalName,
  }));
  return { documents, checklist: buildChecklist(role, documents, await extrasFor(userId, role)) };
}

export async function listMyDocuments(userId: string): Promise<RoleDocuments[] | null> {
  const summary = await buildPartnerSummary(userId);
  if (!summary) return null;
  const out: RoleDocuments[] = [];
  for (const p of summary.profiles) {
    const { documents, checklist } = await documentsForUserRole(userId, p.role);
    out.push({
      role: p.role,
      providerStatus: p.providerStatus,
      checklist,
      outstandingRequired: outstandingRequired(checklist).map((i) => i.type),
      documents,
    });
  }
  return out;
}

export type UploadDocResult =
  | { ok: true }
  | { ok: false; httpStatus: number; code: string; message: string };

const UPLOAD_ERRORS: Record<string, { status: number; message: string }> = {
  STORAGE_DISABLED: { status: 503, message: 'এই পরিবেশে ফাইল আপলোড বন্ধ আছে।' },
  STORAGE_NOT_CONFIGURED: { status: 503, message: 'স্টোরেজ কনফিগার করা নেই। প্রশাসককে জানান।' },
  FILE_TOO_LARGE: { status: 413, message: 'ফাইল অনেক বড়। ৮ এমবির কম ফাইল দিন।' },
  INVALID_TYPE: { status: 415, message: 'শুধু ছবি (JPG/PNG/WebP) বা PDF দেওয়া যাবে।' },
  DANGEROUS_FILE: { status: 415, message: 'এই ধরনের ফাইল দেওয়া যাবে না।' },
  UPLOAD_FAILED: { status: 503, message: 'আপলোড হয়নি। আবার চেষ্টা করুন।' },
};

export async function uploadMyDocument(input: {
  userId: string;
  role: PartnerRole;
  type: PartnerDocumentTypeKey;
  title?: string | undefined;
  file: { buffer: Buffer; name: string; mime: string | null };
  appBaseUrl: string;
}): Promise<UploadDocResult> {
  const summary = await buildPartnerSummary(input.userId);
  const profile = summary?.profiles.find((p) => p.role === input.role);
  if (!profile) {
    return { ok: false, httpStatus: 409, code: 'NO_APPLICATION', message: 'আগে এই ভূমিকায় আবেদন করুন।' };
  }
  if (profile.providerStatus === 'SUSPENDED') {
    return { ok: false, httpStatus: 409, code: 'SUSPENDED', message: 'অ্যাকাউন্ট স্থগিত। ডকুমেন্ট দেওয়া যাবে না।' };
  }
  if (!isTypeAllowedFor(input.role, input.type, await extrasFor(input.userId, input.role))) {
    return { ok: false, httpStatus: 422, code: 'TYPE_NOT_ALLOWED', message: 'এই ভূমিকায় এই ডকুমেন্ট লাগে না।' };
  }

  const up = await uploadFile({
    ownerUserId: input.userId,
    purpose: MobileUploadPurpose.PARTNER_DOCUMENT,
    originalName: input.file.name,
    declaredMime: input.file.mime,
    fileBuffer: input.file.buffer,
    appBaseUrl: input.appBaseUrl,
  });
  if (up.ok !== true) {
    const e = UPLOAD_ERRORS[up.ok] ?? UPLOAD_ERRORS.UPLOAD_FAILED!;
    return { ok: false, httpStatus: e.status, code: String(up.ok), message: e.message };
  }

  await getPrisma().partnerDocument.create({
    data: {
      userId: input.userId,
      role: input.role as PartnerApplicantRole,
      type: input.type as PartnerDocumentType,
      uploadedFileId: up.data.fileId,
      ...(input.title?.trim() ? { title: input.title.trim().slice(0, 120) } : {}),
    },
  });
  return { ok: true };
}

export async function deleteMyDocument(userId: string, docId: string): Promise<UploadDocResult> {
  const prisma = getPrisma();
  const doc = await prisma.partnerDocument.findUnique({
    where: { id: docId },
    select: { userId: true, uploadedFileId: true, reviewStatus: true },
  });
  if (!doc || doc.userId !== userId) {
    return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'ডকুমেন্ট পাওয়া যায়নি।' };
  }
  if (doc.reviewStatus === PartnerDocumentReviewStatus.APPROVED) {
    return { ok: false, httpStatus: 409, code: 'APPROVED_LOCKED', message: 'অনুমোদিত ডকুমেন্ট মোছা যায় না।' };
  }
  await prisma.$transaction([
    prisma.partnerDocument.delete({ where: { id: docId } }),
    prisma.uploadedFile.update({
      where: { id: doc.uploadedFileId },
      data: { status: UploadedFileStatus.DELETED },
    }),
  ]);
  return { ok: true };
}

export async function decideDocument(input: {
  docId: string;
  action: 'approve' | 'reject';
  note?: string | undefined;
}): Promise<UploadDocResult> {
  const prisma = getPrisma();
  const doc = await prisma.partnerDocument.findUnique({ where: { id: input.docId }, select: { id: true } });
  if (!doc) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'ডকুমেন্ট পাওয়া যায়নি।' };
  const approved = input.action === 'approve';
  await prisma.partnerDocument.update({
    where: { id: input.docId },
    data: {
      reviewStatus: approved ? PartnerDocumentReviewStatus.APPROVED : PartnerDocumentReviewStatus.REJECTED,
      reviewNote: approved ? null : input.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });
  return { ok: true };
}
