import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminListModerationQueue } from "@/lib/admin-feed-ecosystem/moderation-service";
import { moderationQuerySchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = moderationQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const queue = await adminListModerationQueue(parsed.data);
    return jsonOk(queue);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load moderation queue", 500);
  }
}
