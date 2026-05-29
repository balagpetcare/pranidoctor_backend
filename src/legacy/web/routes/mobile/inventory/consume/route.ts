import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  consumeInventoryBodySchema,
  getInventoryController,
  mapInventoryError,
} from "../../../../../../modules/inventory/index.js";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = consumeInventoryBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid inventory consume payload",
      422,
      parsed.error.flatten(),
    );
  }

  if (parsed.data.inventoryType === "MEDICINE") {
    const clinicalSources = [
      "FARM_TREATMENT",
      "PRESCRIPTION_ITEM",
      "TREATMENT_CASE",
      "AI_PLAN",
    ] as const;
    if (!clinicalSources.includes(parsed.data.sourceType as (typeof clinicalSources)[number])) {
      return jsonError(
        "FORBIDDEN",
        "Medicine consumption must be linked to a treatment record",
        403,
      );
    }
  }

  try {
    const controller = getInventoryController();
    const result = await controller.consumeStock(
      auth.ctx.customerProfileId,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk(result);
  } catch (e) {
    const mapped = mapInventoryError(e);
    if (mapped) {
      return jsonError(mapped.code, mapped.message, mapped.status);
    }
    return jsonError("DATABASE_ERROR", "Could not consume inventory", 500);
  }
}
