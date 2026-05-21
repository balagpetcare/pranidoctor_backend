import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { ingestMobileUpload } from "@/lib/storage/upload-service";
import { z } from "zod";

export const runtime = "nodejs";

const purposeSchema = z.nativeEnum(MobileUploadPurpose);

function publicBaseUrl(request: Request): string {
  const fromEnv = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_BODY", "multipart/form-data প্রয়োজন", 400);
  }

  const purposeRaw = form.get("purpose");
  const file = form.get("file");

  const purposeParsed = purposeSchema.safeParse(
    typeof purposeRaw === "string" ? purposeRaw.trim() : "",
  );
  if (!purposeParsed.success) {
    return jsonError("VALIDATION_ERROR", "অবৈধ বা অনুপস্থিত purpose", 422);
  }

  if (!(file instanceof File)) {
    return jsonError("VALIDATION_ERROR", "ফাইল ক্ষেত্র (file) প্রয়োজন", 422);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await ingestMobileUpload({
    ownerUserId: auth.ctx.userId,
    purpose: purposeParsed.data,
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

  const base = publicBaseUrl(request);
  const downloadUrl = `${base}/api/mobile/uploads/${result.id}`;

  return jsonOk(
    {
      fileId: result.id,
      storageKey: result.storageKey,
      downloadUrl,
      url: downloadUrl,
      purpose: purposeParsed.data,
      originalName: file.name,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    },
    { status: 201 },
  );
}
