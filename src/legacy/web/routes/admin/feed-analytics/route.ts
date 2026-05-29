import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminGetPlatformFeedAnalytics } from "@/lib/admin-feed-ecosystem/platform-analytics-service";
import { feedAnalyticsQuerySchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = feedAnalyticsQuerySchema.safeParse({
    periodDays: url.searchParams.get("periodDays") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const analytics = await adminGetPlatformFeedAnalytics(parsed.data.periodDays);
    return jsonOk({ analytics });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed analytics", 500);
  }
}
