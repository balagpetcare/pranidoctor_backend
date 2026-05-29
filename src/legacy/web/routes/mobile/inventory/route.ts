import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getInventoryController,
  inventorySummaryQuerySchema,
  mapInventoryError,
} from "../../../../../modules/inventory/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = inventorySummaryQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "farmRef is required",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const controller = getInventoryController();
    const summary = await controller.getSummary(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ summary });
  } catch (e) {
    const mapped = mapInventoryError(e);
    if (mapped) {
      return jsonError(mapped.code, mapped.message, mapped.status);
    }
    return jsonError("DATABASE_ERROR", "Could not load inventory summary", 500);
  }
}
