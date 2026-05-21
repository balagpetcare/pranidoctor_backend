import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminReplaceTechnicianServiceCategories } from "@/lib/admin-ai-technicians/technician-admin-service";
import { technicianMutationErrorResponse } from "@/lib/admin-ai-technicians/mutation-errors";
import { serviceCategoriesBodySchema } from "@/lib/admin-ai-technicians/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = serviceCategoriesBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid service categories payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const technician = await adminReplaceTechnicianServiceCategories(
      id,
      parsed.data.serviceCategoryIds,
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
