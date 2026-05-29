import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getFeedInventoryController,
  mapFeedInventoryError,
  recordFeedPurchaseBodySchema,
} from "../../../../../modules/feed-inventory/index.js";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = recordFeedPurchaseBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid purchase payload", 422, parsed.error.flatten());
  }

  try {
    const result = await getFeedInventoryController().recordPurchase(
      auth.ctx.customerProfileId,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk(result, { status: 201 });
  } catch (e) {
    const mapped = mapFeedInventoryError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not record purchase", 500);
  }
}
