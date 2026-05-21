import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminActivateDoctor } from "@/lib/admin-doctors/doctor-admin-service";
import { doctorMutationErrorResponse } from "@/lib/admin-doctors/mutation-errors";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const doctor = await adminActivateDoctor(id);
    if (!doctor) {
      return jsonError("NOT_FOUND", "Doctor not found", 404);
    }
    return jsonOk({ doctor });
  } catch (e) {
    const mapped = doctorMutationErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
