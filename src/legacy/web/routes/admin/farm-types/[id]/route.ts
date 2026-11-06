import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetFarmType,
  adminPatchFarmType,
} from "@/lib/admin-farm-setup/farm-type-service";
import { jsonError, jsonOk } from "@/lib/api-response";
import { patchFarmTypeConfigBodySchema } from "@/lib/mobile-farms/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;
  try {
    const type = await adminGetFarmType(id);
    if (!type) return jsonError("NOT_FOUND", "Farm type not found", 404);
    return jsonOk({ type });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load farm type", 500);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchFarmTypeConfigBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const type = await adminPatchFarmType(id, parsed.data);
    if (!type) return jsonError("NOT_FOUND", "Farm type not found", 404);
    return jsonOk({ type });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update farm type", 500);
  }
}
