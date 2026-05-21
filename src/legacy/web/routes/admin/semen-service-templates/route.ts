import { AnimalType, SemenTemplateApprovalStatus } from "@/generated/prisma/client";
import { requireAdminApiActor, requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminCreateSemenServiceTemplate,
  adminListSemenTemplates,
} from "@/lib/admin-semen/templates-service";
import {
  createSemenServiceTemplateBodySchema,
  listSemenTemplatesQuerySchema,
} from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listSemenTemplatesQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    animalType: url.searchParams.get("animalType") ?? undefined,
    semenProviderId: url.searchParams.get("semenProviderId") ?? undefined,
    approvalStatus: url.searchParams.get("approvalStatus") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  const isActive =
    parsed.data.isActive === "true"
      ? true
      : parsed.data.isActive === "false"
        ? false
        : undefined;

  try {
    const data = await adminListSemenTemplates({
      ...parsed.data,
      isActive,
      animalType: parsed.data.animalType as AnimalType | undefined,
      approvalStatus: parsed.data.approvalStatus as SemenTemplateApprovalStatus | undefined,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load templates", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createSemenServiceTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const actor = await requireAdminApiActor();
    if (!actor.ok) return actor.response;
    const row = await adminCreateSemenServiceTemplate(parsed.data, actor.actor.id);
    return jsonOk({ template: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "BREED_NOT_FOUND") {
      return jsonError("BREED_NOT_FOUND", "Unknown breed in mix", 422);
    }
    if (msg === "BREED_ANIMAL_TYPE_MISMATCH") {
      return jsonError("BREED_ANIMAL_TYPE_MISMATCH", "Breed animal type must match template", 422);
    }
    if (msg === "MULTIPLE_COVERS") {
      return jsonError("MULTIPLE_COVERS", "Only one COVER media allowed", 422);
    }
    if (msg === "MEDIA_FILE_NOT_FOUND") {
      return jsonError("MEDIA_FILE_NOT_FOUND", "Uploaded file not found", 422);
    }
    if (msg === "PROVIDER_NOT_FOUND") {
      return jsonError("PROVIDER_NOT_FOUND", "Provider not found", 422);
    }
    if (msg === "INVALID_DECIMAL") {
      return jsonError("INVALID_DECIMAL", "Invalid numeric value", 422);
    }
    if (msg === "ACTOR_REQUIRED_FOR_APPROVAL") {
      return jsonError("ACTOR_REQUIRED_FOR_APPROVAL", "Signed-in admin required for this approval state", 422);
    }
    if (msg === "REJECT_REASON_REQUIRED") {
      return jsonError("REJECT_REASON_REQUIRED", "Rejection reason required", 422);
    }
    return jsonError("DATABASE_ERROR", "Could not create template", 500);
  }
}
