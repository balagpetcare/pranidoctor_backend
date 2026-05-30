import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiPlatformAdminService } from "../../../../../../modules/ai/platform/ai-platform-admin.service.js";

function parseSinceDays(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("sinceDays");
  const n = raw ? Number.parseInt(raw, 10) : 30;
  return Math.min(90, Math.max(1, Number.isFinite(n) ? n : 30));
}

export async function GET(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getAiPlatformAdminService().getUsageDashboard(parseSinceDays(request));
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load AI usage dashboard", 500);
  }
}
