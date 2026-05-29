import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  dailyRecommendationQuerySchema,
  getFeedRecommendationController,
  mapFeedRecommendationError,
} from "../../../../modules/feed-recommendation/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = dailyRecommendationQuerySchema.safeParse({
    livestockId: url.searchParams.get("livestockId") ?? undefined,
    planDate: url.searchParams.get("planDate") ?? url.searchParams.get("date") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const recommendation = await getFeedRecommendationController().getDailyRecommendation(
      auth.ctx.customerProfileId,
      parsed.data.livestockId,
      parsed.data,
    );
    return jsonOk({ recommendation });
  } catch (e) {
    const mapped = mapFeedRecommendationError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not build recommendation", 500);
  }
}
