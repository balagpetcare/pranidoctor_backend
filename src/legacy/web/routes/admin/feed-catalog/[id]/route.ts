import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetFeedCatalog,
  adminPatchFeedCatalog,
} from "@/lib/admin-feed-catalog/catalog-service";
import { patchFeedCatalogBodySchema } from "@/lib/admin-feed-catalog/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;
  try {
    const row = await adminGetFeedCatalog(id);
    if (!row) return jsonError("NOT_FOUND", "Feed catalog item not found", 404);
    return jsonOk({ item: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed catalog item", 500);
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

  const parsed = patchFeedCatalogBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const row = await adminPatchFeedCatalog(id, parsed.data);
    if (!row) return jsonError("NOT_FOUND", "Feed catalog item not found", 404);
    return jsonOk({ item: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update feed catalog item", 500);
  }
}
