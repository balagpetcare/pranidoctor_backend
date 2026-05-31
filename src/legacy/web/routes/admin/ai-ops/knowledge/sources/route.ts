import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getKnowledgeSourceRegistryService } from "../../../../../../modules/ai/knowledge-ingestion/registry/source-registry.service.js";

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "SUPER_ADMIN" && auth.actor.role !== "ADMIN") {
    return jsonError("FORBIDDEN", "Admin role required", 403);
  }
  try {
    const data = await getKnowledgeSourceRegistryService().listSources();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load knowledge sources", 500);
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
    const data = await getKnowledgeSourceRegistryService().createSource({
      sourceKey: String(body.sourceKey),
      sourceClass: body.sourceClass as never,
      sourceType: body.sourceType as never,
      titleBn: String(body.titleBn ?? body.titleEn ?? ""),
      titleEn: String(body.titleEn ?? body.titleBn ?? ""),
      publisher: body.publisher ? String(body.publisher) : undefined,
      publishYear: typeof body.publishYear === "number" ? body.publishYear : undefined,
      edition: body.edition ? String(body.edition) : undefined,
      jurisdiction: body.jurisdiction ? String(body.jurisdiction) : undefined,
      trustTier: typeof body.trustTier === "number" ? body.trustTier : undefined,
      defaultEvidenceLevel: body.defaultEvidenceLevel as never,
      allowedDomains: body.allowedDomains as never,
      licenseId: body.licenseId ? String(body.licenseId) : undefined,
      refreshPolicyDays:
        typeof body.refreshPolicyDays === "number" ? body.refreshPolicyDays : undefined,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to create knowledge source", 500);
  }
}
