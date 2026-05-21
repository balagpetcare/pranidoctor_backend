import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { markNotificationRead } from "@/lib/notifications/notification-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await markNotificationRead(auth.ctx.userId, id);
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Notification not found", 404);
    }
    return jsonOk({ notification: result.notification });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update notification", 500);
  }
}
