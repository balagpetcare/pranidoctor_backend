import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiKnowledgeService } from "../../../../../../modules/ai/knowledge/ai-knowledge.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getAiKnowledgeService().listAdmin();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load knowledge entries", 500);
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
    const data = await getAiKnowledgeService().create({
      contentType: body.contentType as never,
      slug: String(body.slug),
      titleBn: String(body.titleBn),
      titleEn: String(body.titleEn),
      bodyBn: String(body.bodyBn),
      bodyEn: String(body.bodyEn),
      species: body.species as never,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to create knowledge entry", 500);
  }
}
