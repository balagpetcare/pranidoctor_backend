import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getFeedRecommendationController,
  mapFeedRecommendationError,
  previewRecommendationBodySchema,
} from "../../../../../modules/feed-recommendation/index.js";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = previewRecommendationBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid preview payload", 422, parsed.error.flatten());
  }

  try {
    const recommendation = await getFeedRecommendationController().previewRecommendation(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ recommendation });
  } catch (e) {
    const mapped = mapFeedRecommendationError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not preview recommendation", 500);
  }
}
