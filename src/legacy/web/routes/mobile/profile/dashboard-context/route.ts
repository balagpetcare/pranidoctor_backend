import { jsonError, jsonOk } from "@/lib/api-response";
import { buildMobileProfileDashboardContext } from "@/lib/mobile-profile/dashboard-context-service";
import { requireMobileProfileDashboardContextUser } from "@/lib/mobile-profile/profile-dashboard-guard";

/**
 * Mobile Profile tab routing context — `GET /api/mobile/profile/dashboard-context`.
 *
 * Uses the same Bearer mobile JWT as `/api/mobile/me`, but allows `CUSTOMER`,
 * `AI_TECHNICIAN`, and `DOCTOR` (with profile) so promoted technicians are not blocked.
 */
export async function GET(request: Request) {
  const auth = await requireMobileProfileDashboardContextUser(request);
  if (!auth.ok) return auth.response;

  try {
    const data = await buildMobileProfileDashboardContext(auth.ctx.userId);
    return jsonOk(data);
  } catch (e) {
    if (e instanceof Error && e.message === "USER_NOT_FOUND") {
      return jsonError("NOT_FOUND", "User not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not load dashboard context", 500);
  }
}
