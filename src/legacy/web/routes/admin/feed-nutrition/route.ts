import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminListFeedNutrition } from "@/lib/admin-feed-ecosystem/nutrition-service";
import { nutritionListQuerySchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = nutritionListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
    missingOnly: url.searchParams.get("missingOnly") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await adminListFeedNutrition(parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load nutrition data", 500);
  }
}
