import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getBatchFeedDashboardForCustomer } from "@/lib/mobile-fattening/feed-plan-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const dashboard = await getBatchFeedDashboardForCustomer(
      auth.ctx.customerProfileId,
      id,
    );
    return jsonOk({ dashboard });
  } catch (e) {
    if (e instanceof Error && e.message === "BATCH_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not load feed dashboard", 500);
  }
}
