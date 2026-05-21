import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { updateContentCategoryBodySchema } from "@/lib/knowledge-hub/schemas";
import {
  getContentCategoryForAdmin,
  updateContentCategoryForAdmin,
} from "@/lib/knowledge-hub/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const category = await getContentCategoryForAdmin(id);
    if (!category) {
      return jsonError("NOT_FOUND", "Category not found", 404);
    }
    return jsonOk({ category });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load category", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = updateContentCategoryBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid category payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await updateContentCategoryForAdmin(id, {
      ...parsed.data,
      nameEn:
        parsed.data.nameEn === undefined ? undefined : parsed.data.nameEn,
      description:
        parsed.data.description === undefined
          ? undefined
          : parsed.data.description,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "Category not found", 404);
      }
      if (result.code === "SLUG_TAKEN") {
        return jsonError("SLUG_TAKEN", "Slug is already in use", 409);
      }
      return jsonError("DATABASE_ERROR", "Could not update category", 500);
    }
    return jsonOk({ category: result.category });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update category", 500);
  }
}
