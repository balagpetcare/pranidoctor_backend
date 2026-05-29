import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getLivestockController,
  mapLivestockError,
  updateLivestockSchema,
} from "../../../../../modules/livestock/index.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const livestock = await getLivestockController().getById(auth.ctx.customerProfileId, id);
    return jsonOk({ livestock });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not load livestock", 500);
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

  const parsed = updateLivestockSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid update payload", 422, parsed.error.flatten());
  }

  try {
    const livestock = await getLivestockController().update(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk({ livestock });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not update livestock", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    await getLivestockController().softDelete(auth.ctx.customerProfileId, id, auth.ctx.userId);
    return jsonOk({ deleted: true });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not delete livestock", 500);
  }
}
