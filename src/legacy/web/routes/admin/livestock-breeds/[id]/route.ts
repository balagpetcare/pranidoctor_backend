import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminGetLivestockBreed, adminPatchLivestockBreed } from "@/lib/admin-semen/breeds-service";
import { patchLivestockBreedBodySchema } from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;
  try {
    const row = await adminGetLivestockBreed(id);
    if (!row) return jsonError("NOT_FOUND", "Breed not found", 404);
    return jsonOk({ breed: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load breed", 500);
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

  const parsed = patchLivestockBreedBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const row = await adminPatchLivestockBreed(id, parsed.data);
    if (!row) return jsonError("NOT_FOUND", "Breed not found", 404);
    return jsonOk({ breed: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update breed", 500);
  }
}
