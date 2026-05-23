import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { mapUploadError } from "@/lib/storage/mobile-upload-handler";
import { deleteFile } from "@/lib/storage/storage-module";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id?.trim()) {
    return jsonError("VALIDATION_ERROR", "File id is required", 400);
  }

  const result = await deleteFile({
    fileId: id.trim(),
    ownerUserId: auth.ctx.userId,
  });

  if (result.ok !== true) {
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "File not found", 404);
    }
    return mapUploadError(result.ok);
  }

  return jsonOk({ success: true, fileId: id.trim() });
}
