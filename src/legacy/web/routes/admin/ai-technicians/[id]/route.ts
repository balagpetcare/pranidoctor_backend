import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetTechnicianById,
  adminPatchTechnician,
  serializeTechnicianDetail,
} from "@/lib/admin-ai-technicians/technician-admin-service";
import { technicianMutationErrorResponse } from "@/lib/admin-ai-technicians/mutation-errors";
import { patchTechnicianBodySchema } from "@/lib/admin-ai-technicians/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const row = await adminGetTechnicianById(id);
    if (!row) {
      return jsonError("NOT_FOUND", "Technician not found", 404);
    }
    return jsonOk({ technician: serializeTechnicianDetail(row) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load technician", 500);
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

  const parsed = patchTechnicianBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid technician payload",
      422,
      parsed.error.flatten(),
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return jsonError("VALIDATION_ERROR", "No fields to update", 422);
  }

  try {
    const technician = await adminPatchTechnician(id, parsed.data);
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
