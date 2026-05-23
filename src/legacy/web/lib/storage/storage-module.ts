import { randomUUID } from "node:crypto";

import type { MobileUploadPurpose } from "@/generated/prisma/client";

import {
  deleteObjectBytes,
  getSignedGetObjectUrl,
  getSignedPutObjectUrl,
  putObjectBytes,
} from "./s3-client";
import type { StorageEnv } from "./storage-env";
import { getStorageEnv, isS3Configured } from "./storage-env";
import { ingestMobileUpload } from "./upload-service";

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_OPERATION_TIMEOUT_MS = 30_000;

export type StorageOperationError =
  | "STORAGE_DISABLED"
  | "STORAGE_NOT_CONFIGURED"
  | "FILE_TOO_LARGE"
  | "INVALID_TYPE"
  | "DANGEROUS_FILE"
  | "NOT_FOUND"
  | "UPLOAD_FAILED";

export type MobileUploadPayload = {
  success: true;
  url: string;
  objectKey: string;
  mimeType: string;
  size: string;
  bucket: string;
  fileId: string;
  purpose?: MobileUploadPurpose;
  originalName?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options?: { attempts?: number; timeoutMs?: number },
): Promise<T> {
  const attempts = options?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error("STORAGE_TIMEOUT")), timeoutMs);
        }),
      ]);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(250 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("STORAGE_OPERATION_FAILED");
}

export function buildAppDownloadUrl(baseUrl: string, fileId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/mobile/uploads/${fileId}`;
}

export function toMobileUploadPayload(params: {
  fileId: string;
  storageKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  purpose?: MobileUploadPurpose;
  originalName?: string;
}): MobileUploadPayload {
  return {
    success: true,
    url: params.downloadUrl,
    objectKey: params.storageKey,
    mimeType: params.mimeType,
    size: String(params.sizeBytes),
    bucket: params.bucket,
    fileId: params.fileId,
    ...(params.purpose ? { purpose: params.purpose } : {}),
    ...(params.originalName ? { originalName: params.originalName } : {}),
  };
}

export async function uploadFile(params: {
  ownerUserId: string;
  purpose: MobileUploadPurpose;
  originalName: string;
  declaredMime: string | null;
  fileBuffer: Buffer;
  appBaseUrl: string;
}): Promise<
  | { ok: true; data: MobileUploadPayload }
  | { ok: StorageOperationError }
> {
  const env = getStorageEnv();
  if (env.driver === "disabled") return { ok: "STORAGE_DISABLED" };
  if (!isS3Configured(env)) return { ok: "STORAGE_NOT_CONFIGURED" };

  try {
    const result = await ingestMobileUpload({
      ownerUserId: params.ownerUserId,
      purpose: params.purpose,
      originalName: params.originalName,
      declaredMime: params.declaredMime,
      fileBuffer: params.fileBuffer,
    });

    if (result.ok !== true) {
      return { ok: result.ok };
    }

    const downloadUrl = buildAppDownloadUrl(params.appBaseUrl, result.id);
    return {
      ok: true,
      data: toMobileUploadPayload({
        fileId: result.id,
        storageKey: result.storageKey,
        bucket: result.bucket,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        downloadUrl,
        purpose: params.purpose,
        originalName: params.originalName,
      }),
    };
  } catch {
    return { ok: "UPLOAD_FAILED" };
  }
}

export async function deleteFile(params: {
  fileId: string;
  ownerUserId: string;
}): Promise<{ ok: true } | { ok: StorageOperationError }> {
  const { deleteUploadedFileById } = await import("./upload-download.js");
  const result = await deleteUploadedFileById(params.fileId, params.ownerUserId);
  if (result === "NOT_FOUND") return { ok: "NOT_FOUND" };
  if (result === "NOT_CONFIGURED") return { ok: "STORAGE_NOT_CONFIGURED" };
  if (result === "DELETE_FAILED") return { ok: "UPLOAD_FAILED" };
  return { ok: true };
}

export function getPublicUrl(params: {
  fileId: string;
  appBaseUrl: string;
  env?: StorageEnv;
}): string {
  const env = params.env ?? getStorageEnv();
  const appUrl = buildAppDownloadUrl(params.appBaseUrl, params.fileId);
  if (env.publicUrl) {
    return appUrl;
  }
  return appUrl;
}

export async function generatePresignedUrl(params: {
  key: string;
  method?: "GET" | "PUT";
  expiresInSeconds?: number;
  env?: StorageEnv;
}): Promise<{ ok: true; url: string; expiresIn: number } | { ok: "NOT_CONFIGURED" }> {
  const env = params.env ?? getStorageEnv();
  if (!isS3Configured(env)) return { ok: "NOT_CONFIGURED" };

  const expiresIn = params.expiresInSeconds ?? env.signedUrlExpirySeconds;

  try {
    const url = await withRetry(async () => {
      if (params.method === "GET") {
        return getSignedGetObjectUrl({ env, key: params.key, expiresIn });
      }
      return getSignedPutObjectUrl({ env, key: params.key, expiresIn });
    });

    return { ok: true, url, expiresIn };
  } catch {
    return { ok: "NOT_CONFIGURED" };
  }
}

export function buildPresignedObjectKey(params: {
  ownerUserId: string;
  purpose: MobileUploadPurpose;
  originalName: string;
}): string {
  const safe = params.originalName
    .split(/[/\\]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80) || "file";
  const id = randomUUID();
  const ext = safe.includes(".") ? safe.split(".").pop() ?? "bin" : "bin";
  return `uploads/v1/${params.ownerUserId}/${params.purpose}/${id}-${safe}.${ext}`;
}

export async function putObjectWithRetry(params: {
  env: StorageEnv;
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await withRetry(() =>
    putObjectBytes({
      env: params.env,
      key: params.key,
      body: params.body,
      contentType: params.contentType,
    }),
  );
}

export async function deleteObjectWithRetry(params: {
  env: StorageEnv;
  key: string;
}): Promise<void> {
  await withRetry(() => deleteObjectBytes(params));
}
