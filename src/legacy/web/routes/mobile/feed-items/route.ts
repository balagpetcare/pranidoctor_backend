import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getFeedController,
  listFeedItemsQuerySchema,
  mapFeedError,
} from "../../../../modules/feed/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listFeedItemsQuerySchema.safeParse({
    category: url.searchParams.get("category") ?? undefined,
    search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? "true",
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortOrder: url.searchParams.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getFeedController().listFeedItems(parsed.data);
    return jsonOk(result);
  } catch (e) {
    const mapped = mapFeedError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list feed items", 500);
  }
}
