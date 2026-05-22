import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { analyticsFeedsForCustomer } from "@/lib/mobile-feeds/feed-service";
import { feedAnalyticsQuerySchema } from "@/lib/mobile-feeds/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = feedAnalyticsQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const analytics = await analyticsFeedsForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ analytics });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed analytics", 500);
  }
}
