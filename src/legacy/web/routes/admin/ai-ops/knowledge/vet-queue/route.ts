import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getKnowledgeVetApprovalWorkflowService } from "../../../../../../modules/ai/knowledge-ingestion/workflow/vet-approval-workflow.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getKnowledgeVetApprovalWorkflowService().listVetQueue();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load vet queue", 500);
  }
}
