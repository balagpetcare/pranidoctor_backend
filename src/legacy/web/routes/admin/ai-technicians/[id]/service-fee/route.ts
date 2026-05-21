import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminUpdateServiceFee } from "@/lib/admin-ai-technicians/technician-admin-service";
import { technicianMutationErrorResponse } from "@/lib/admin-ai-technicians/mutation-errors";
import {
  parseServiceFeeInput,
  serviceFeeBodySchema,
} from "@/lib/admin-ai-technicians/schemas";
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

  const parsed = serviceFeeBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid service fee payload",
      422,
      parsed.error.flatten(),
    );
  }

  let feeValue;
  try {
    feeValue = parseServiceFeeInput(parsed.data);
  } catch {
    return jsonError(
      "VALIDATION_ERROR",
      "serviceFeeBdt must be a non-negative number",
      422,
    );
  }

  try {
    const technician = await adminUpdateServiceFee(id, feeValue);
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
