import { MobileUploadPurpose, UploadedFileStatus } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrlForUploadedFile } from "@/lib/storage/upload-download";

export const runtime = "nodejs";

/** Purposes safe to fetch without auth (opaque UUID; Image.network has no Bearer). */
const PUBLIC_DOWNLOAD_PURPOSES: MobileUploadPurpose[] = [
  MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO,
  MobileUploadPurpose.CUSTOMER_COVER_IMAGE,
  MobileUploadPurpose.AI_TECHNICIAN_PROFILE_PHOTO,
  MobileUploadPurpose.AI_TECHNICIAN_COVER_IMAGE,
  MobileUploadPurpose.AI_TECHNICIAN_NID_FRONT,
  MobileUploadPurpose.AI_TECHNICIAN_NID_BACK,
];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return jsonError("VALIDATION_ERROR", "আইডি প্রয়োজন", 400);
  }

  const row = await prisma.uploadedFile.findFirst({
    where: { id, status: UploadedFileStatus.ACTIVE },
    select: { ownerUserId: true, fileCategory: true },
  });
  if (!row) {
    return jsonError("NOT_FOUND", "ফাইল পাওয়া যায়নি", 404);
  }

  if (PUBLIC_DOWNLOAD_PURPOSES.includes(row.fileCategory)) {
    const signed = await getSignedDownloadUrlForUploadedFile(id);
    if (signed === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "ফাইল পাওয়া যায়নি", 404);
    }
    if (signed === "NOT_CONFIGURED") {
      return jsonError("STORAGE_NOT_CONFIGURED", "স্টোরেজ কনফিগার করা নেই", 503);
    }
    return Response.redirect(signed.url, 302);
  }

  const SEMEN_TEMPLATE_MEDIA_DOWNLOAD_PURPOSES: MobileUploadPurpose[] = [
    MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_COVER,
    MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_GALLERY,
    MobileUploadPurpose.ADMIN_SEMEN_TEMPLATE_VIDEO,
  ];

  if (SEMEN_TEMPLATE_MEDIA_DOWNLOAD_PURPOSES.includes(row.fileCategory)) {
    const auth = await requireMobileAiTechnicianModuleUser(request);
    if (!auth.ok) return auth.response;
    const signed = await getSignedDownloadUrlForUploadedFile(id);
    if (signed === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "ফাইল পাওয়া যায়নি", 404);
    }
    if (signed === "NOT_CONFIGURED") {
      return jsonError("STORAGE_NOT_CONFIGURED", "স্টোরেজ কনফিগার করা নেই", 503);
    }
    return Response.redirect(signed.url, 302);
  }

  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  if (row.ownerUserId !== auth.ctx.userId) {
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
