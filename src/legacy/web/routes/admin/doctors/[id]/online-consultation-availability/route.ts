import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminUpdateOnlineConsultation } from "@/lib/admin-doctors/doctor-admin-service";
import { doctorMutationErrorResponse } from "@/lib/admin-doctors/mutation-errors";
import { onlineConsultationBodySchema } from "@/lib/admin-doctors/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = onlineConsultationBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid availability payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const doctor = await adminUpdateOnlineConsultation(
      id,
      parsed.data.acceptsOnlineConsultation,
    );
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
