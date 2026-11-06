import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getFarmForCustomer,
  updateFarmForCustomer,
} from "@/lib/mobile-farms/farm-service";
import { typeErrorResponse } from "@/lib/mobile-farms/errors";
import { updateFarmBodySchema } from "@/lib/mobile-farms/schemas";

type RouteContext = { params: Promise<{ id: string }> };

function mapError(e: unknown, fallback: string) {
  if (e instanceof Error && e.message === "FARM_NOT_FOUND") {
    return jsonError("NOT_FOUND", "Farm not found", 404);
  }
  if (e instanceof Error) {
    const m = typeErrorResponse(e.message);
    if (m) return m;
  }
  return jsonError("DATABASE_ERROR", fallback, 500);
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const farm = await getFarmForCustomer(auth.ctx.customerProfileId, id);
    return jsonOk({ farm });
  } catch (e) {
    return mapError(e, "Could not load farm");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = updateFarmBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid farm payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const farm = await updateFarmForCustomer(auth.ctx.customerProfileId, id, parsed.data);
    return jsonOk({ farm });
  } catch (e) {
    return mapError(e, "Could not update farm");
  }
}
