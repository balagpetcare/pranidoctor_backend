import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { deleteNotificationForUser } from "@/lib/notifications/notification-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  try {
    const result = await deleteNotificationForUser(auth.ctx.userId, id);
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Notification not found", 404);
    }
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not delete notification", 500);
  }
}
