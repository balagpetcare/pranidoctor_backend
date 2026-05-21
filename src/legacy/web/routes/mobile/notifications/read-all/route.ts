import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { markAllNotificationsRead } from "@/lib/notifications/notification-service";

export async function PATCH(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await markAllNotificationsRead(auth.ctx.userId);
    return jsonOk({ updatedCount: result.updatedCount });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update notifications", 500);
  }
}
