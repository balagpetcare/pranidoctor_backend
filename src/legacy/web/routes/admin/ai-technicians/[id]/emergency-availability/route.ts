import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminUpdateEmergencyAvailability } from "@/lib/admin-ai-technicians/technician-admin-service";
import { technicianMutationErrorResponse } from "@/lib/admin-ai-technicians/mutation-errors";
import { availabilityBodySchema } from "@/lib/admin-ai-technicians/schemas";
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

  const parsed = availabilityBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid availability payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const technician = await adminUpdateEmergencyAvailability(
      id,
      parsed.data.acceptsEmergency,
    );
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
