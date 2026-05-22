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
    if (e instanceof Error && e.message === "ANIMAL_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not create feed record", 500);
  }
}
