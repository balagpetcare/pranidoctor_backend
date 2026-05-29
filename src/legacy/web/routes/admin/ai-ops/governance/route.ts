import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiAuditService } from "../../../../../../modules/ai/audit/ai-audit.service.js";
import { getAiOrchestratorService } from "../../../../../../modules/ai/orchestrator/ai-orchestrator.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getAiAuditService().listEscalations();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load escalations", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }
  const disable = Boolean((json as { disable?: boolean }).disable);
  if (disable) getAiOrchestratorService().disableLlm();
  else getAiOrchestratorService().enableLlm();
  return jsonOk({ llmDisabled: getAiOrchestratorService().isLlmDisabled() });
}
