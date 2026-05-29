import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createFeedConsumptionBodySchema,
  feedConsumptionListQuerySchema,
  getFeedConsumptionController,
  mapFeedConsumptionError,
} from "../../../../modules/feed-consumption/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = feedConsumptionListQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
    livestockId: url.searchParams.get("livestockId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getFeedConsumptionController().list(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk(result);
  } catch (e) {
    const mapped = mapFeedConsumptionError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list feed consumption", 500);
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

  const parsed = createFeedConsumptionBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid consumption payload", 422, parsed.error.flatten());
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;

  try {
    const record = await getFeedConsumptionController().create(
      auth.ctx.customerProfileId,
      parsed.data,
      idempotencyKey ?? undefined,
    );
    return jsonOk({ record }, { status: 201 });
  } catch (e) {
    const mapped = mapFeedConsumptionError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not create feed consumption", 500);
  }
}
