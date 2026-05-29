import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  addInventoryBodySchema,
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

  const parsed = addInventoryBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid inventory add payload",
      422,
      parsed.error.flatten(),
    );
  }

  if (
    parsed.data.inventoryType === "MEDICINE" &&
    parsed.data.operation === "CREATE_ITEM" &&
    (parsed.data.displayName?.toLowerCase().includes("prescription") ||
      parsed.data.notes?.toLowerCase().includes("diagnosis"))
  ) {
    return jsonError(
      "FORBIDDEN",
      "Medicine inventory cannot store prescriptions or diagnoses",
      403,
    );
  }

  try {
    const controller = getInventoryController();
    const result = await controller.addStock(
      auth.ctx.customerProfileId,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk(result, { status: 201 });
  } catch (e) {
    const mapped = mapInventoryError(e);
    if (mapped) {
      return jsonError(mapped.code, mapped.message, mapped.status);
    }
    return jsonError("DATABASE_ERROR", "Could not update inventory", 500);
  }
}
