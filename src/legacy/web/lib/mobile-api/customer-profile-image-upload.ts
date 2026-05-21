import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { publicMobileAssetBaseUrl } from "@/lib/mobile-api/public-base-url";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { prisma } from "@/lib/prisma";
import { ingestMobileUpload } from "@/lib/storage/upload-service";

/**
 * Multipart `file` — jpg/png/webp (server sniffs); size limits per purpose.
 * Persists public app URL on [CustomerProfile] (not raw storage keys).
 */
export async function postCustomerImageAndSaveProfileField(
  request: Request,
  purpose: MobileUploadPurpose,
  profileField: "profilePhotoUrl" | "coverPhotoUrl",
): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_BODY", "multipart/form-data প্রয়োজন", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("VALIDATION_ERROR", "ফাইল ক্ষেত্র (file) প্রয়োজন", 422);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await ingestMobileUpload({
    ownerUserId: auth.ctx.userId,
    purpose,
    originalName: file.name || "upload.bin",
    declaredMime: file.type || null,
    fileBuffer: buf,
  });

  if (result.ok === "STORAGE_DISABLED") {
    return jsonError("STORAGE_DISABLED", "ফাইল আপলোড এই পরিবেশে বন্ধ", 503);
  }
  if (result.ok === "STORAGE_NOT_CONFIGURED") {
    return jsonError(
      "STORAGE_NOT_CONFIGURED",
      "স্টোরেজ কনফিগার করা নেই। অ্যাডমিনকে জানান।",
      503,
    );
  }
  if (result.ok === "FILE_TOO_LARGE") {
    return jsonError("FILE_TOO_LARGE", "ফাইলের আকার সীমা অতিক্রম করেছে", 413);
  }
  if (result.ok === "INVALID_TYPE") {
    return jsonError("INVALID_TYPE", "ফাইলের ধরন গ্রহণযোগ্য নয়", 415);
  }
  if (result.ok === "DANGEROUS_FILE") {
    return jsonError("DANGEROUS_FILE", "এই ধরনের ফাইল গ্রহণ করা হয় না", 415);
  }

  const base = publicMobileAssetBaseUrl(request);
  const downloadUrl = `${base}/api/mobile/uploads/${result.id}`;

  await prisma.customerProfile.update({
    where: { id: auth.ctx.customerProfileId },
    data:
      profileField === "profilePhotoUrl"
        ? { profilePhotoUrl: downloadUrl }
        : { coverPhotoUrl: downloadUrl },
  });

  const payload: Record<string, unknown> = {
    fileId: result.id,
    storageKey: result.storageKey,
    downloadUrl,
    originalName: file.name,
    mimeType: result.mimeType,
    sizeBytes: result.sizeBytes,
  };
  payload[profileField] = downloadUrl;

  return jsonOk(payload, { status: 201 });
}
