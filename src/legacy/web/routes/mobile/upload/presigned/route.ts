import { MobileUploadPurpose } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { handleMobilePresignedRequest } from "@/lib/storage/mobile-upload-handler";
import { z } from "zod";

export const runtime = "nodejs";

const purposeSchema = z.nativeEnum(MobileUploadPurpose);

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const purposeRaw = url.searchParams.get("purpose")?.trim() ?? "";
  const fileName = url.searchParams.get("fileName")?.trim() ?? "upload.bin";
  const fileId = url.searchParams.get("fileId")?.trim();
  const methodRaw = (url.searchParams.get("method")?.trim() ?? "PUT").toUpperCase();
  const expiresRaw = url.searchParams.get("expiresIn")?.trim();
  const expiresParsed = expiresRaw ? Number.parseInt(expiresRaw, 10) : undefined;

  const purposeParsed = purposeSchema.safeParse(purposeRaw);
  if (!purposeParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid or missing purpose", 422);
  }

  if (methodRaw !== "GET" && methodRaw !== "PUT") {
    return jsonError("VALIDATION_ERROR", "method must be GET or PUT", 422);
  }

  return handleMobilePresignedRequest({
    request,
    ownerUserId: auth.ctx.userId,
    purpose: purposeParsed.data,
    fileName,
    method: methodRaw,
    fileId,
    expiresInSeconds:
      expiresParsed && Number.isFinite(expiresParsed) && expiresParsed > 0
        ? expiresParsed
        : undefined,
  });
}
