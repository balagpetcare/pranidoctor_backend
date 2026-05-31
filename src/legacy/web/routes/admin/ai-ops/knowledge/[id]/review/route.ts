import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getKnowledgeEditorialWorkflowService } from "../../../../../../../modules/ai/knowledge-ingestion/workflow/editorial-workflow.service.js";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }
  const body = json as Record<string, unknown>;
  try {
    const data = await getKnowledgeEditorialWorkflowService().completeEditorialReview({
      knowledgeEntryId: id,
      reviewerId: auth.actor.userId,
      decision: (body.decision as "APPROVE" | "REQUEST_CHANGES" | "REJECT") ?? "APPROVE",
      comments: body.comments ? String(body.comments) : undefined,
      evidenceLevel: body.evidenceLevel as never,
    });
    return jsonOk(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Review failed";
    return jsonError("REVIEW_FAILED", message, 400);
  }
}
