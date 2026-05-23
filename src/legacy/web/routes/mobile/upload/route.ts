import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
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
  const file = form.get("file");

  const purposeParsed = purposeSchema.safeParse(
    typeof purposeRaw === "string" ? purposeRaw.trim() : "",
  );
  if (!purposeParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid or missing purpose", 422);
  }

  if (!(file instanceof File)) {
    return jsonError("VALIDATION_ERROR", "file field is required", 422);
  }

  return handleMobileFileUpload({
    request,
    ownerUserId: auth.ctx.userId,
    purpose: purposeParsed.data,
    file,
  });
}
