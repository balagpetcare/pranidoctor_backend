import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getBatchFeedPlanForCustomer,
  upsertBatchFeedPlanForCustomer,
} from "@/lib/mobile-fattening/feed-plan-service";
import { upsertBatchFeedPlanBodySchema } from "@/lib/mobile-fattening/feed-plan-schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const plan = await getBatchFeedPlanForCustomer(
      auth.ctx.customerProfileId,
      id,
    );
    return jsonOk({ plan });
  } catch (e) {
    if (e instanceof Error && e.message === "BATCH_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not load feed plan", 500);
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

  const parsed = upsertBatchFeedPlanBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid feed plan payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const plan = await upsertBatchFeedPlanForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    return jsonOk({ plan });
  } catch (e) {
    if (e instanceof Error && e.message === "BATCH_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not save feed plan", 500);
  }
}
