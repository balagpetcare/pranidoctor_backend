import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  getFeedController,
  updateFeedItemBodySchema,
  mapFeedError,
} from "../../../../../modules/feed/index.js";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
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

export async function PATCH(request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = updateFeedItemBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const item = await getFeedController().updateFeedItem(id, parsed.data);
    return jsonOk({ item });
  } catch (e) {
    const mapped = mapFeedError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not update feed item", 500);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  try {
    const item = await getFeedController().deactivateFeedItem(id);
    return jsonOk({ item });
  } catch (e) {
    const mapped = mapFeedError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not deactivate feed item", 500);
  }
}
