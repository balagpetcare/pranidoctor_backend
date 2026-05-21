import { requireAdminApiActor, requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetSemenTemplate,
  adminPatchSemenServiceTemplate,
  type PatchSemenServiceTemplateInput,
} from "@/lib/admin-semen/templates-service";
import { patchSemenServiceTemplateBodySchema } from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;
  try {
    const row = await adminGetSemenTemplate(id);
    if (!row) return jsonError("NOT_FOUND", "Template not found", 404);
    return jsonOk({ template: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load template", 500);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchSemenServiceTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  const actor = await requireAdminApiActor();
  if (!actor.ok) return actor.response;

  try {
    const row = await adminPatchSemenServiceTemplate(
      id,
      parsed.data as PatchSemenServiceTemplateInput,
      actor.actor.id,
    );
    if (!row) return jsonError("NOT_FOUND", "Template not found", 404);
    return jsonOk({ template: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "BREED_NOT_FOUND") {
      return jsonError("BREED_NOT_FOUND", "Unknown breed in mix", 422);
    }
    if (msg === "BREED_ANIMAL_TYPE_MISMATCH") {
      return jsonError("BREED_ANIMAL_TYPE_MISMATCH", "Breed animal type must match template", 422);
    }
    if (msg === "BREED_MIX_SUM") {
      return jsonError("BREED_MIX_SUM", "Percentages must sum to 100", 422);
    }
    if (msg === "OFFER_DISCOUNT_BOTH") {
      return jsonError("OFFER_DISCOUNT_BOTH", "Cannot set both offer and discount", 422);
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
    return jsonError("DATABASE_ERROR", "Could not update template", 500);
  }
}
