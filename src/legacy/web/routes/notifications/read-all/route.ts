import { jsonError, jsonOk } from "@/lib/api-response";
import { requireNotificationViewer } from "@/lib/notifications/guard";
import { markAllNotificationsRead } from "@/lib/notifications/notification-service";

export async function PATCH(request: Request) {
  const auth = await requireNotificationViewer(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await markAllNotificationsRead(auth.ctx.userId);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update notifications", 500);
  }
}
