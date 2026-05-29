import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminListFeedCategoryMeta,
  adminPatchFeedCategoryMeta,
} from "@/lib/admin-feed-ecosystem/category-meta-service";
import { patchCategoryMetaSchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const categories = await adminListFeedCategoryMeta();
    return jsonOk({ categories });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed categories", 500);
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchCategoryMetaSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const categories = await adminPatchFeedCategoryMeta(parsed.data);
    return jsonOk({ categories });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update feed categories", 500);
  }
}
