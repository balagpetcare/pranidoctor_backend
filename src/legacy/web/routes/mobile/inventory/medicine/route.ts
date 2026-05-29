import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getInventoryController,
  inventoryListQuerySchema,
  mapInventoryError,
} from "../../../../../../modules/inventory/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = inventoryListQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    activeOnly: url.searchParams.get("activeOnly") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
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
    const controller = getInventoryController();
    const result = await controller.listMedicine(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch (e) {
    const mapped = mapInventoryError(e);
    if (mapped) {
      return jsonError(mapped.code, mapped.message, mapped.status);
    }
    return jsonError("DATABASE_ERROR", "Could not load medicine inventory", 500);
  }
}
