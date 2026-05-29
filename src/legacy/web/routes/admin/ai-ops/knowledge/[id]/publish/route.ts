import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiKnowledgeService } from "../../../../../../../modules/ai/knowledge/ai-knowledge.service.js";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  const { id } = await context.params;
  try {
    const data = await getAiKnowledgeService().publish(id, auth.actor.userId);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to publish entry", 500);
  }
}
