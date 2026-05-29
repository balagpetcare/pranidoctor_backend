import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  feedInventoryLowStockQuerySchema,
  getFeedInventoryController,
  mapFeedInventoryError,
} from "../../../../../modules/feed-inventory/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = feedInventoryLowStockQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "farmRef is required", 422, parsed.error.flatten());
  }

  try {
    const alerts = await getFeedInventoryController().getLowStockAlerts(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ alerts });
  } catch (e) {
    const mapped = mapFeedInventoryError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not load alerts", 500);
  }
}
