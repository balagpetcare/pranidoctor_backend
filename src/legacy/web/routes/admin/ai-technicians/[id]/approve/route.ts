import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminApproveTechnician } from "@/lib/admin-ai-technicians/technician-admin-service";
import { technicianMutationErrorResponse } from "@/lib/admin-ai-technicians/mutation-errors";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const technician = await adminApproveTechnician(id);
    if (!technician) {
      return jsonError("NOT_FOUND", "Technician not found", 404);
    }
    return jsonOk({ technician });
  } catch (e) {
    const mapped = technicianMutationErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
