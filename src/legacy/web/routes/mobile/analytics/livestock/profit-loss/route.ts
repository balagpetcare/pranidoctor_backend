import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  feedAnalyticsRangeQuerySchema,
  getFeedAnalyticsService,
} from "../../../../../../modules/feed-analytics/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = feedAnalyticsRangeQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const profitLoss = await getFeedAnalyticsService().getProfitLoss(
      auth.ctx.customerProfileId,
      parsed.data.farmRef,
      parsed.data.from,
      parsed.data.to,
    );
    return jsonOk({ profitLoss });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load profit/loss", 500);
  }
}
