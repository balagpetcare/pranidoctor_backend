import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiAuditService } from "../../../../../../modules/ai/audit/ai-audit.service.js";
import { getAiGovernanceService } from "../../../../../../modules/ai/governance/ai-governance.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const escalations = await getAiAuditService().listEscalations();
    const panel = await getAiGovernanceService().buildGovernancePanel(escalations);
    return jsonOk(panel);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load governance", 500);
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
  const body = json as {
    disable?: boolean;
    reason?: string;
    expectedVersion?: number;
    rollbackOfId?: string;
  };
  const disable = Boolean(body.disable);
  try {
    const governance = await getAiGovernanceService().setLlmDisabled({
      llmDisabled: disable,
      reason: body.reason,
      actorId: auth.actor.id,
      actorRole: auth.actor.role,
      source: "admin_ui",
      expectedVersion: body.expectedVersion,
      rollbackOfId: body.rollbackOfId,
    });
    return jsonOk({
      llmDisabled: governance.llmDisabled,
      version: governance.version,
      governance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "AI_GOVERNANCE_UPDATE_FAILED";
    const status =
      code === "AI_GOVERNANCE_ENABLE_FORBIDDEN" || code === "FORBIDDEN"
        ? 403
        : code === "AI_GOVERNANCE_STORE_UNAVAILABLE"
          ? 503
          : 400;
    return jsonError(code, message, status);
  }
}
