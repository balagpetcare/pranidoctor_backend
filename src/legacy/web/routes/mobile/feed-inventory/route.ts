import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createFeedInventoryBodySchema,
  getFeedInventoryController,
  listFeedInventoryQuerySchema,
  mapFeedInventoryError,
} from "../../../../modules/feed-inventory/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listFeedInventoryQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getFeedInventoryController().listInventory(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk(result);
  } catch (e) {
    const mapped = mapFeedInventoryError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list feed inventory", 500);
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

  const parsed = createFeedInventoryBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid inventory payload", 422, parsed.error.flatten());
  }

  try {
    const item = await getFeedInventoryController().createInventory(
      auth.ctx.customerProfileId,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk({ item }, { status: 201 });
  } catch (e) {
    const mapped = mapFeedInventoryError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not create feed inventory", 500);
  }
}
