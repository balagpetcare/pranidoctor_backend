import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getBatchRoiForCustomer,
  upsertBatchRoiForCustomer,
} from "@/lib/mobile-fattening/roi-service";
import { upsertBatchRoiBodySchema } from "@/lib/mobile-fattening/roi-schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const roi = await getBatchRoiForCustomer(auth.ctx.customerProfileId, id);
    return jsonOk({ roi });
  } catch (e) {
    if (e instanceof Error && e.message === "BATCH_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not load batch ROI", 500);
  }
}

export async function PUT(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = upsertBatchRoiBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid ROI payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const settings = await upsertBatchRoiForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    const roi = await getBatchRoiForCustomer(auth.ctx.customerProfileId, id);
    return jsonOk({ settings, roi });
  } catch (e) {
    if (e instanceof Error && e.message === "BATCH_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not save batch ROI", 500);
  }
}
