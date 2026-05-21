import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetTechnicianApplicationById,
  serializeTechnicianApplicationDetail,
} from "@/lib/admin-ai-technician-applications/application-review-service";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const row = await adminGetTechnicianApplicationById(id);
    if (!row) {
      return jsonError("NOT_FOUND", "আবেদন খুঁজে পাওয়া যায়নি", 404);
    }
    return jsonOk({ technician: serializeTechnicianApplicationDetail(row) });
  } catch {
    return jsonError("DATABASE_ERROR", "বিস্তারিত লোড করা যায়নি", 500);
  }
}
