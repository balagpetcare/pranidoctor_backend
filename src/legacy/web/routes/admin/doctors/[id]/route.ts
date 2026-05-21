import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetDoctorById,
  adminPatchDoctor,
  serializeDoctorDetail,
} from "@/lib/admin-doctors/doctor-admin-service";
import { doctorMutationErrorResponse } from "@/lib/admin-doctors/mutation-errors";
import { patchDoctorBodySchema } from "@/lib/admin-doctors/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const row = await adminGetDoctorById(id);
    if (!row) {
      return jsonError("NOT_FOUND", "Doctor not found", 404);
    }
    return jsonOk({ doctor: serializeDoctorDetail(row) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load doctor", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchDoctorBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid doctor payload",
      422,
      parsed.error.flatten(),
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return jsonError("VALIDATION_ERROR", "No fields to update", 422);
  }

  try {
    const doctor = await adminPatchDoctor(id, parsed.data);
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
