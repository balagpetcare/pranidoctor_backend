import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { handleMobileFileUpload } from "@/lib/storage/mobile-upload-handler";
import { z } from "zod";

export const runtime = "nodejs";

const purposeSchema = z.nativeEnum(MobileUploadPurpose);

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_BODY", "multipart/form-data required", 400);
  }

  const purposeRaw = form.get("purpose");
  const purposeParsed = purposeSchema.safeParse(
    typeof purposeRaw === "string" ? purposeRaw.trim() : "",
  );
  if (!purposeParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid or missing purpose", 422);
  }

  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    const single = form.get("file");
    if (single instanceof File) files.push(single);
  }

  if (files.length === 0) {
    return jsonError("VALIDATION_ERROR", "At least one file is required", 422);
  }
  if (files.length > 10) {
    return jsonError("VALIDATION_ERROR", "Maximum 10 files per request", 422);
  }

  const uploads = [];
  for (const file of files) {
    const response = await handleMobileFileUpload({
      request,
      ownerUserId: auth.ctx.userId,
      purpose: purposeParsed.data,
      file,
    });
    if (response.status >= 400) {
      return response;
    }
    const body = (await response.json()) as { ok: true; data: Record<string, unknown> };
    uploads.push(body.data);
  }

  return jsonOk({ success: true, uploads }, { status: 201 });
}
