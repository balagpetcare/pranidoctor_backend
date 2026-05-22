import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getUnreadCountForUser } from "@/lib/notifications/notification-service";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const { count } = await getUnreadCountForUser(auth.ctx.userId);
    return jsonOk({ count });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load unread count", 500);
  }
}
