import { jsonError } from "@/lib/api-response";
import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { UploadedFileStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrlForUploadedFile } from "@/lib/storage/upload-download";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const admin = await requireAdminApiActor();
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  if (!id?.trim()) {
    return jsonError("VALIDATION_ERROR", "আইডি প্রয়োজন", 400);
  }

  const exists = await prisma.uploadedFile.findFirst({
    where: { id, status: UploadedFileStatus.ACTIVE },
    select: { id: true },
  });
  if (!exists) {
    return jsonError("NOT_FOUND", "ফাইল পাওয়া যায়নি", 404);
  }

  const signed = await getSignedDownloadUrlForUploadedFile(id);
  if (signed === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "ফাইল পাওয়া যায়নি", 404);
  }
  if (signed === "NOT_CONFIGURED") {
    return jsonError("STORAGE_NOT_CONFIGURED", "স্টোরেজ কনফিগার করা নেই", 503);
  }

  return Response.redirect(signed.url, 302);
}
