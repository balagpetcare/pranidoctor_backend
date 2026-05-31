import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getKnowledgeImportPipelineService } from "../../../../../../modules/ai/knowledge-ingestion/pipeline/import-pipeline.service.js";

export async function GET(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  const sourceId = new URL(request.url).searchParams.get("sourceId") ?? undefined;
  try {
    const data = await getKnowledgeImportPipelineService().listImportRuns(sourceId);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load import runs", 500);
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
  const body = json as Record<string, unknown>;
  try {
    const data = await getKnowledgeImportPipelineService().runImport({
      sourceId: String(body.sourceId),
      documentId: body.documentId ? String(body.documentId) : undefined,
      adapterId: String(body.adapterId ?? "csv-generic-v1"),
      triggeredById: auth.actor.userId,
      dryRun: Boolean(body.dryRun),
      rows: Array.isArray(body.rows) ? (body.rows as never[]) : [],
    });
    return jsonOk(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to run import";
    return jsonError("IMPORT_FAILED", message, 500);
  }
}
