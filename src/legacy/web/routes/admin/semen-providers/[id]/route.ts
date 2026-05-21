import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminGetSemenProvider, adminPatchSemenProvider } from "@/lib/admin-semen/providers-service";
import { patchSemenProviderBodySchema } from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;
  try {
    const row = await adminGetSemenProvider(id);
    if (!row) return jsonError("NOT_FOUND", "Provider not found", 404);
    return jsonOk({ provider: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load provider", 500);
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

  const parsed = patchSemenProviderBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const row = await adminPatchSemenProvider(id, parsed.data);
    if (!row) return jsonError("NOT_FOUND", "Provider not found", 404);
    return jsonOk({ provider: row });
  } catch (e) {
    if (e instanceof Error && e.message === "LOGO_FILE_NOT_FOUND") {
      return jsonError("LOGO_FILE_NOT_FOUND", "Logo file not found", 422);
    }
    return jsonError("DATABASE_ERROR", "Could not update provider", 500);
  }
}
