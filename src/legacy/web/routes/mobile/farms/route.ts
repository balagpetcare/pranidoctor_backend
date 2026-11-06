import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createFarmForCustomer,
  listFarmsForCustomer,
} from "@/lib/mobile-farms/farm-service";
import { typeErrorResponse } from "@/lib/mobile-farms/errors";
import { createFarmBodySchema } from "@/lib/mobile-farms/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const farms = await listFarmsForCustomer(auth.ctx.customerProfileId);
    return jsonOk({ farms });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load farms", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createFarmBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid farm payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const farm = await createFarmForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ farm });
  } catch (e) {
    if (e instanceof Error && e.message === "FARM_ID_TAKEN") {
      return jsonError("CONFLICT", "Farm id already in use", 409);
    }
    if (e instanceof Error) {
      const m = typeErrorResponse(e.message);
      if (m) return m;
    }
    return jsonError("DATABASE_ERROR", "Could not create farm", 500);
  }
}
