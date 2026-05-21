import { createHash, randomUUID } from "node:crypto";

import {
  AiTechnicianDocumentType,
  MobileUploadPurpose,
  UploadedFileStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { isDangerousExtension, isDangerousMime, sniffMimeFromBuffer } from "./mime-sniff";
import { putObjectBytes } from "./s3-client";
import type { StorageEnv } from "./storage-env";
import { getStorageEnv, isS3Configured } from "./storage-env";

export type ProcessedUpload = {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
};

function sanitizeBaseName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return cleaned.length > 0 ? cleaned : "file";
}

function purposeMaxBytes(env: StorageEnv, purpose: MobileUploadPurpose): number {
  const mb = (name: string, fallback: number) =>
    Math.round(parseMbEnv(name, fallback) * 1024 * 1024);

  switch (purpose) {
    case MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO:
      return mb("UPLOAD_MAX_CUSTOMER_PROFILE_MB", 3);
    case MobileUploadPurpose.CUSTOMER_COVER_IMAGE:
      return mb("UPLOAD_MAX_CUSTOMER_COVER_MB", 5);
    case MobileUploadPurpose.AI_TECHNICIAN_PROFILE_PHOTO:
      return mb("UPLOAD_MAX_AI_TECHNICIAN_PROFILE_MB", 3);
    case MobileUploadPurpose.AI_TECHNICIAN_COVER_IMAGE:
      return mb("UPLOAD_MAX_AI_TECHNICIAN_COVER_MB", 5);
    case MobileUploadPurpose.AI_TECHNICIAN_NID_FRONT:
    case MobileUploadPurpose.AI_TECHNICIAN_NID_BACK:
      return mb("UPLOAD_MAX_AI_TECHNICIAN_NID_MB", 8);
    case MobileUploadPurpose.AI_TECHNICIAN_TRAINING_CERTIFICATE:
    case MobileUploadPurpose.AI_TECHNICIAN_AI_CERTIFICATE:
    case MobileUploadPurpose.AI_TECHNICIAN_OTHER:
      return mb("UPLOAD_MAX_AI_TECHNICIAN_DOCUMENT_MB", 8);
    case MobileUploadPurpose.ADMIN_SEMEN_PROVIDER_LOGO:
    case MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_COVER:
    case MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_GALLERY:
      return mb("UPLOAD_MAX_IMAGE_MB", 5);
    case MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_VIDEO:
      return mb("UPLOAD_MAX_SEMEN_TEMPLATE_VIDEO_MB", 80);
    case MobileUploadPurpose.AI_SERVICE_INSTANCE_COVER:
    case MobileUploadPurpose.AI_SERVICE_INSTANCE_GALLERY:
      return mb("UPLOAD_MAX_IMAGE_MB", 5);
    case MobileUploadPurpose.AI_SERVICE_INSTANCE_VIDEO:
      return mb("UPLOAD_MAX_SEMEN_TEMPLATE_VIDEO_MB", 80);
    case MobileUploadPurpose.AI_SERVICE_INSTANCE_DOCUMENT:
      return mb("UPLOAD_MAX_AI_TECHNICIAN_DOCUMENT_MB", 8);
    default:
      return env.maxImageBytes;
  }
}

function parseMbEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number.parseFloat(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function allowedMimeForPurpose(env: StorageEnv, purpose: MobileUploadPurpose): Set<string> {
  if (
    purpose === MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_VIDEO ||
    purpose === MobileUploadPurpose.AI_SERVICE_INSTANCE_VIDEO
  ) {
    return env.allowedVideoMimes;
  }
  const docPurposes: MobileUploadPurpose[] = [
    MobileUploadPurpose.AI_TECHNICIAN_TRAINING_CERTIFICATE,
    MobileUploadPurpose.AI_TECHNICIAN_AI_CERTIFICATE,
    MobileUploadPurpose.AI_TECHNICIAN_OTHER,
    MobileUploadPurpose.AI_SERVICE_INSTANCE_DOCUMENT,
  ];
  return docPurposes.includes(purpose) ? env.allowedDocumentMimes : env.allowedImageMimes;
}

async function maybeProcessImage(buffer: Buffer, sniffed: string): Promise<ProcessedUpload> {
  const isRaster =
    sniffed === "image/jpeg" || sniffed === "image/png" || sniffed === "image/webp";
  if (!isRaster) {
    return { buffer, mimeType: sniffed };
  }
  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const pipeline = sharp(buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 });
    const out = await pipeline.toBuffer();
    const meta = await sharp(out).metadata();
    return {
      buffer: out,
      mimeType: "image/webp",
      width: meta.width ?? undefined,
      height: meta.height ?? undefined,
    };
  } catch {
    return { buffer, mimeType: sniffed };
  }
}

export async function ingestMobileUpload(params: {
  ownerUserId: string;
  purpose: MobileUploadPurpose;
  originalName: string;
  declaredMime: string | null;
  fileBuffer: Buffer;
}): Promise<
  | {
      ok: true;
      id: string;
      storageKey: string;
      bucket: string;
      mimeType: string;
      sizeBytes: number;
      checksum: string;
      width?: number;
      height?: number;
    }
  | { ok: "STORAGE_DISABLED" }
  | { ok: "STORAGE_NOT_CONFIGURED" }
  | { ok: "FILE_TOO_LARGE" }
  | { ok: "INVALID_TYPE" }
  | { ok: "DANGEROUS_FILE" }
> {
  const env = getStorageEnv();
  if (env.driver === "disabled") {
    return { ok: "STORAGE_DISABLED" };
  }
  if (!isS3Configured(env)) {
    return { ok: "STORAGE_NOT_CONFIGURED" };
  }

  if (isDangerousExtension(params.originalName)) {
    return { ok: "DANGEROUS_FILE" };
  }

  const maxBytes = purposeMaxBytes(env, params.purpose);
  if (params.fileBuffer.length > maxBytes) {
    return { ok: "FILE_TOO_LARGE" };
  }

  const sniffed = sniffMimeFromBuffer(params.fileBuffer);
  if (!sniffed) {
    return { ok: "INVALID_TYPE" };
  }
  if (isDangerousMime(sniffed)) {
    return { ok: "DANGEROUS_FILE" };
  }

  const declared = params.declaredMime?.trim().toLowerCase() || null;
  if (declared && declared !== sniffed && declared !== "application/octet-stream") {
    return { ok: "INVALID_TYPE" };
  }

  const allowed = allowedMimeForPurpose(env, params.purpose);
  if (!allowed.has(sniffed)) {
    return { ok: "INVALID_TYPE" };
  }

  const processed =
    sniffed === "application/pdf"
      ? { buffer: params.fileBuffer, mimeType: sniffed }
      : sniffed.startsWith("video/")
        ? { buffer: params.fileBuffer, mimeType: sniffed }
        : await maybeProcessImage(params.fileBuffer, sniffed);

  const checksum = createHash("sha256").update(processed.buffer).digest("hex");
  const safe = sanitizeBaseName(params.originalName);
  const id = randomUUID();
  const ext = (() => {
    const mt = processed.mimeType;
    if (mt === "application/pdf") return "pdf";
    if (mt === "image/webp") return "webp";
    if (mt === "image/png") return "png";
    if (mt.startsWith("video/")) {
      if (mt === "video/webm") return "webm";
      return "mp4";
    }
    return "jpg";
  })();
  const storageKey = `uploads/v1/${params.ownerUserId}/${params.purpose}/${id}-${safe}.${ext}`;

  await putObjectBytes({
    env,
    key: storageKey,
    body: processed.buffer,
    contentType: processed.mimeType,
  });

  const row = await prisma.uploadedFile.create({
    data: {
      ownerUserId: params.ownerUserId,
      bucket: env.bucket,
      storageKey,
      originalName: params.originalName.slice(0, 240),
      mimeType: processed.mimeType,
      sizeBytes: processed.buffer.length,
      fileCategory: params.purpose,
      checksum,
      width: processed.width ?? null,
      height: processed.height ?? null,
      status: UploadedFileStatus.ACTIVE,
    },
  });

  return {
    ok: true,
    id: row.id,
    storageKey: row.storageKey,
    bucket: row.bucket,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum,
    width: processed.width,
    height: processed.height,
  };
}

/** Map technician document enum to expected upload purpose (for linking validation). */
export function documentTypeToUploadPurpose(
  t: AiTechnicianDocumentType,
): MobileUploadPurpose {
  switch (t) {
    case AiTechnicianDocumentType.NID_FRONT:
      return MobileUploadPurpose.AI_TECHNICIAN_NID_FRONT;
    case AiTechnicianDocumentType.NID_BACK:
      return MobileUploadPurpose.AI_TECHNICIAN_NID_BACK;
    case AiTechnicianDocumentType.PROFILE_PHOTO:
      return MobileUploadPurpose.AI_TECHNICIAN_PROFILE_PHOTO;
    case AiTechnicianDocumentType.COVER_IMAGE:
      return MobileUploadPurpose.AI_TECHNICIAN_COVER_IMAGE;
    case AiTechnicianDocumentType.TRAINING_CERTIFICATE:
      return MobileUploadPurpose.AI_TECHNICIAN_TRAINING_CERTIFICATE;
    case AiTechnicianDocumentType.AI_CERTIFICATE:
      return MobileUploadPurpose.AI_TECHNICIAN_AI_CERTIFICATE;
    default:
      return MobileUploadPurpose.AI_TECHNICIAN_OTHER;
  }
}
