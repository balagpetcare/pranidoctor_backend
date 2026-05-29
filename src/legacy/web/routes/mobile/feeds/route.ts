import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createFeedForCustomer,
  listFeedsForCustomer,
} from "@/lib/mobile-feeds/feed-service";
import {
  createFeedBodySchema,
  listFeedsQuerySchema,
} from "@/lib/mobile-feeds/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listFeedsQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    animalId: url.searchParams.get("animalId") ?? undefined,
    batchId: url.searchParams.get("batchId") ?? undefined,
    fatteningBatchId: url.searchParams.get("fatteningBatchId") ?? undefined,
    feedType: url.searchParams.get("feedType") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
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
    const result = await listFeedsForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed records", 500);
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

  const parsed = createFeedBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid feed payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const record = await createFeedForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ record }, { status: 201 });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "ANIMAL_NOT_FOUND") {
        return jsonError("NOT_FOUND", "Animal not found", 404);
      }
      if (e.message === "BATCH_NOT_FOUND") {
        return jsonError("NOT_FOUND", "Fattening batch not found", 404);
      }
      if (e.message === "ANIMAL_NOT_IN_BATCH") {
        return jsonError("ANIMAL_NOT_IN_BATCH", "Animal is not in this batch", 422);
      }
      if (e.message === "FARM_REF_REQUIRED") {
        return jsonError("VALIDATION_ERROR", "farmRef is required when deducting stock", 422);
      }
    }
    if (e && typeof e === "object" && "code" in e) {
      const code = String((e as { code: string }).code);
      if (code === "INSUFFICIENT_STOCK") {
        return jsonError("INSUFFICIENT_STOCK", "Insufficient feed stock", 409);
      }
      if (code === "ITEM_NOT_FOUND" || code === "INVENTORY_ITEM_NOT_FOUND") {
        return jsonError("INVENTORY_ITEM_NOT_FOUND", "Feed inventory item not found", 404);
      }
      if (code === "FARM_MISMATCH" || code === "ITEM_TYPE_MISMATCH") {
        return jsonError("INVENTORY_ITEM_MISMATCH", "Inventory item does not match feed log", 400);
      }
    }
    return jsonError("DATABASE_ERROR", "Could not create feed record", 500);
  }
}
