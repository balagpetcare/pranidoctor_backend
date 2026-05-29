import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getFeedController, mapFeedError } from "../../../../../modules/feed/index.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(_request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const item = await getFeedController().getFeedItemById(id);
    return jsonOk({ item });
  } catch (e) {
    const mapped = mapFeedError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not load feed item", 500);
  }
}
