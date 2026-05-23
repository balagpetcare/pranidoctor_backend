import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { publicMobileAssetBaseUrl } from "@/lib/mobile-api/public-base-url";

import {
  buildPresignedObjectKey,
  generatePresignedUrl,
  toMobileUploadPayload,
  uploadFile,
} from "./storage-module";

export type IngestUploadErrorCode =
  | "STORAGE_DISABLED"
  | "STORAGE_NOT_CONFIGURED"
  | "FILE_TOO_LARGE"
  | "INVALID_TYPE"
  | "DANGEROUS_FILE"
  | "UPLOAD_FAILED";

const ERROR_MESSAGES: Record<IngestUploadErrorCode, { code: string; message: string; status: number }> =
  {
    STORAGE_DISABLED: {
      code: "STORAGE_DISABLED",
      message: "File upload is disabled in this environment",
      status: 503,
    },
    STORAGE_NOT_CONFIGURED: {
      code: "STORAGE_NOT_CONFIGURED",
      message: "Storage is not configured",
      status: 503,
    },
    FILE_TOO_LARGE: {
      code: "FILE_TOO_LARGE",
      message: "File exceeds size limit",
      status: 413,
    },
    INVALID_TYPE: {
      code: "INVALID_TYPE",
      message: "File type is not allowed",
      status: 415,
    },
    DANGEROUS_FILE: {
      code: "DANGEROUS_FILE",
      message: "This file type is not allowed",
      status: 415,
    },
    UPLOAD_FAILED: {
      code: "UPLOAD_FAILED",
      message: "Upload failed after retries",
      status: 503,
    },
  };

export function mapUploadError(error: IngestUploadErrorCode): Response {
  const mapped = ERROR_MESSAGES[error];
  return jsonError(mapped.code, mapped.message, mapped.status);
}

export async function handleMobileFileUpload(params: {
  request: Request;
  ownerUserId: string;
  purpose: MobileUploadPurpose;
  file: File;
}): Promise<Response> {
  const buf = Buffer.from(await params.file.arrayBuffer());
  const base = publicMobileAssetBaseUrl(params.request);

  const result = await uploadFile({
    ownerUserId: params.ownerUserId,
    purpose: params.purpose,
    originalName: params.file.name || "upload.bin",
    declaredMime: params.file.type || null,
    fileBuffer: buf,
    appBaseUrl: base,
  });

  if (result.ok !== true) {
    return mapUploadError(result.ok);
  }

  return jsonOk(result.data, { status: 201 });
}

export async function handleMobilePresignedRequest(params: {
  request: Request;
  ownerUserId: string;
  purpose: MobileUploadPurpose;
  fileName: string;
  method: "GET" | "PUT";
  fileId?: string;
  expiresInSeconds?: number;
}): Promise<Response> {
  const base = publicMobileAssetBaseUrl(params.request);

  if (params.method === "GET") {
    if (!params.fileId?.trim()) {
      return jsonError("VALIDATION_ERROR", "fileId is required for GET presigned URLs", 422);
    }
    const { getActiveUploadedFileOrNull } = await import("./upload-download.js");
    const row = await getActiveUploadedFileOrNull(params.fileId.trim());
    if (!row || row.ownerUserId !== params.ownerUserId) {
      return jsonError("NOT_FOUND", "File not found", 404);
    }
    const signed = await generatePresignedUrl({
      key: row.storageKey,
      method: "GET",
      expiresInSeconds: params.expiresInSeconds,
    });
    if (signed.ok !== true) {
      return jsonError("STORAGE_NOT_CONFIGURED", "Storage is not configured", 503);
    }
    return jsonOk({
      success: true,
      url: signed.url,
      method: "GET",
      fileId: row.id,
      objectKey: row.storageKey,
      bucket: row.bucket,
      expiresIn: signed.expiresIn,
      appUrl: toMobileUploadPayload({
        fileId: row.id,
        storageKey: row.storageKey,
        bucket: row.bucket,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        downloadUrl: `${base}/api/mobile/uploads/${row.id}`,
      }).url,
    });
  }

  const objectKey = buildPresignedObjectKey({
    ownerUserId: params.ownerUserId,
    purpose: params.purpose,
    originalName: params.fileName,
  });

  const signed = await generatePresignedUrl({
    key: objectKey,
    method: "PUT",
    expiresInSeconds: params.expiresInSeconds,
  });
  if (signed.ok !== true) {
    return jsonError("STORAGE_NOT_CONFIGURED", "Storage is not configured", 503);
  }

  return jsonOk({
    success: true,
    url: signed.url,
    method: "PUT",
    objectKey,
    bucket: process.env.S3_BUCKET?.trim() || process.env.MINIO_BUCKET?.trim() || "pranidoctor-dev",
    expiresIn: signed.expiresIn,
    purpose: params.purpose,
  });
}
