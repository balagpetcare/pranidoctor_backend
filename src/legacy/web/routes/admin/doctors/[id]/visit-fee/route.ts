import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminUpdateVisitFee } from "@/lib/admin-doctors/doctor-admin-service";
import { doctorMutationErrorResponse } from "@/lib/admin-doctors/mutation-errors";
import {
  parseVisitFeeInput,
  visitFeeBodySchema,
} from "@/lib/admin-doctors/schemas";
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

  const parsed = visitFeeBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid visit fee payload",
      422,
      parsed.error.flatten(),
    );
  }

  let feeValue;
  try {
    feeValue = parseVisitFeeInput(parsed.data);
  } catch {
    return jsonError(
      "VALIDATION_ERROR",
      "visitFeeBdt must be a non-negative number",
      422,
    );
  }

  try {
    const doctor = await adminUpdateVisitFee(id, feeValue);
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
