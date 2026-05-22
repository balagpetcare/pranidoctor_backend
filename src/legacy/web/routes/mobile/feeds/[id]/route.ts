import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  deleteFeedForCustomer,
  getFeedForCustomer,
  patchFeedForCustomer,
} from "@/lib/mobile-feeds/feed-service";
import { patchFeedBodySchema } from "@/lib/mobile-feeds/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const record = await getFeedForCustomer(auth.ctx.customerProfileId, id);
    if (!record) {
      return jsonError("NOT_FOUND", "Feed record not found", 404);
    }
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed record", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchFeedBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid feed payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const record = await patchFeedForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    if (!record) {
      return jsonError("NOT_FOUND", "Feed record not found", 404);
    }
    return jsonOk({ record });
  } catch (e) {
    if (e instanceof Error && e.message === "ANIMAL_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not update feed record", 500);
  }
}

export async function DELETE(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const deleted = await deleteFeedForCustomer(auth.ctx.customerProfileId, id);
    if (!deleted) {
      return jsonError("NOT_FOUND", "Feed record not found", 404);
    }
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not delete feed record", 500);
  }
}
