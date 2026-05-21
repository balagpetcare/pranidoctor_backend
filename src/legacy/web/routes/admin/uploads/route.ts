import { MobileUploadPurpose } from "@/generated/prisma/client";
import { requireAdminApiActor, requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { ingestMobileUpload } from "@/lib/storage/upload-service";
import { z } from "zod";

export const runtime = "nodejs";

const adminSemenPurposeSchema = z.enum([
  MobileUploadPurpose.ADMIN_SEMEN_PROVIDER_LOGO,
  MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_COVER,
  MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_GALLERY,
  MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_VIDEO,
]);

function publicBaseUrl(request: Request): string {
  const fromEnv = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const actor = await requireAdminApiActor();
  if (!actor.ok) return actor.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_BODY", "multipart/form-data required", 400);
  }

  const purposeRaw = form.get("purpose");
  const file = form.get("file");

  const purposeParsed = adminSemenPurposeSchema.safeParse(
    typeof purposeRaw === "string" ? purposeRaw.trim() : "",
  );
  if (!purposeParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid purpose for admin semen upload", 422);
  }

  if (!(file instanceof File)) {
    return jsonError("VALIDATION_ERROR", "file field required", 422);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await ingestMobileUpload({
    ownerUserId: actor.actor.id,
    purpose: purposeParsed.data,
    originalName: file.name || "upload.bin",
    declaredMime: file.type || null,
    fileBuffer: buf,
  });

  if (result.ok === "STORAGE_DISABLED") {
    return jsonError("STORAGE_DISABLED", "Uploads disabled", 503);
  }
  if (result.ok === "STORAGE_NOT_CONFIGURED") {
    return jsonError("STORAGE_NOT_CONFIGURED", "Storage not configured", 503);
  }
  if (result.ok === "FILE_TOO_LARGE") {
    return jsonError("FILE_TOO_LARGE", "File too large", 413);
  }
  if (result.ok === "INVALID_TYPE") {
    return jsonError("INVALID_TYPE", "Invalid file type", 415);
  }
  if (result.ok === "DANGEROUS_FILE") {
    return jsonError("DANGEROUS_FILE", "Dangerous file rejected", 415);
  }

  const base = publicBaseUrl(request);
  const downloadUrl = `${base}/api/admin/uploads/${result.id}`;

  return jsonOk(
    {
      fileId: result.id,
      storageKey: result.storageKey,
      downloadUrl,
      purpose: purposeParsed.data,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    },
    { status: 201 },
  );
}
