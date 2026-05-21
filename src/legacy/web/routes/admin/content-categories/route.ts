import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  createContentCategoryBodySchema,
} from "@/lib/knowledge-hub/schemas";
import {
  createContentCategoryForAdmin,
  listContentCategoriesForAdmin,
} from "@/lib/knowledge-hub/service";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const categories = await listContentCategoriesForAdmin();
    return jsonOk({ categories });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load categories", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createContentCategoryBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid category payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createContentCategoryForAdmin({
      nameBn: parsed.data.nameBn,
      nameEn: parsed.data.nameEn ?? null,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    });
    if (!result.ok) {
      if (result.code === "SLUG_TAKEN") {
        return jsonError("SLUG_TAKEN", "Slug is already in use", 409);
      }
      return jsonError("DATABASE_ERROR", "Could not create category", 500);
    }
    return jsonOk({ category: result.category }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not create category", 500);
  }
}
