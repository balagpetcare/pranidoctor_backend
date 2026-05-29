import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiPromptService } from "../../../../../../modules/ai/prompts/ai-prompt.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getAiPromptService().list();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load prompts", 500);
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
    const data = await getAiPromptService().create({
      key: String(body.key),
      name: String(body.name),
      systemBn: String(body.systemBn),
      systemEn: String(body.systemEn),
      description: body.description ? String(body.description) : undefined,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to create prompt", 500);
  }
}
