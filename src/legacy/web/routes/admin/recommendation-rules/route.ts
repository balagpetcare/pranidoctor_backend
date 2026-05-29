import { requireAdminApiActor, requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetRecommendationRules,
  adminSaveRecommendationRules,
} from "@/lib/admin-feed-ecosystem/recommendation-rules-service";
import { recommendationRulesBodySchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const payload = await adminGetRecommendationRules();
    return jsonOk(payload);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load recommendation rules", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required to edit rules", 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = recommendationRulesBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const payload = await adminSaveRecommendationRules(parsed.data.rules);
    return jsonOk(payload);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not save recommendation rules", 500);
  }
}
