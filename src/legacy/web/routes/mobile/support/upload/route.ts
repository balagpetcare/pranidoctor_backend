import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { publicMobileAssetBaseUrl } from "@/lib/mobile-api/public-base-url";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { ingestMobileUpload } from "@/lib/storage/upload-service";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_BODY", "multipart/form-data required", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("VALIDATION_ERROR", "file field is required", 422);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await ingestMobileUpload({
    ownerUserId: auth.ctx.userId,
    purpose: MobileUploadPurpose.SUPPORT_ATTACHMENT,
    originalName: file.name || "upload.bin",
    declaredMime: file.type || null,
    fileBuffer: buf,
  });

  if (result.ok === "STORAGE_DISABLED") {
    return jsonError("STORAGE_DISABLED", "File upload is disabled in this environment", 503);
  }
  if (result.ok === "STORAGE_NOT_CONFIGURED") {
    return jsonError("STORAGE_NOT_CONFIGURED", "Storage is not configured", 503);
  }
  if (result.ok === "FILE_TOO_LARGE") {
    return jsonError("FILE_TOO_LARGE", "File exceeds size limit", 413);
  }
  if (result.ok === "INVALID_TYPE") {
    return jsonError("INVALID_TYPE", "File type is not allowed", 415);
  }
  if (result.ok === "DANGEROUS_FILE") {
    return jsonError("DANGEROUS_FILE", "This file type is not allowed", 415);
  }

  const base = publicMobileAssetBaseUrl(request);
  const downloadUrl = `${base}/api/mobile/uploads/${result.id}`;

  return jsonOk(
    {
      fileId: result.id,
      storageKey: result.storageKey,
      downloadUrl,
      originalName: file.name,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    },
    { status: 201 },
  );
}
