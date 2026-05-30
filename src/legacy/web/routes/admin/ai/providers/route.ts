import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiPlatformAdminService } from "../../../../../../modules/ai/platform/ai-platform-admin.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getAiPlatformAdminService().getProvidersDashboard();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load AI providers dashboard", 500);
  }
}
