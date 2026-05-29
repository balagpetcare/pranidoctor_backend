import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  getFeedController,
  adminListFeedItemsQuerySchema,
  createFeedItemBodySchema,
  mapFeedError,
} from "../../../../modules/feed/index.js";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = adminListFeedItemsQuerySchema.safeParse({
    category: url.searchParams.get("category") ?? undefined,
    search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? undefined,
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

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createFeedItemBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const item = await getFeedController().createFeedItem(parsed.data);
    return jsonOk({ item }, { status: 201 });
  } catch (e) {
    const mapped = mapFeedError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not create feed item", 500);
  }
}
