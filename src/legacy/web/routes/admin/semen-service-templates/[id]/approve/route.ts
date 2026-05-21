import { requireAdminApiActor, requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminApproveSemenTemplate } from "@/lib/admin-semen/templates-service";
import { approveSemenTemplateBodySchema } from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const actor = await requireAdminApiActor();
  if (!actor.ok) return actor.response;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = approveSemenTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const row = await adminApproveSemenTemplate(
      id,
      parsed.data.action === "APPROVE" ? "APPROVE" : "REJECT",
      actor.actor.id,
      parsed.data.rejectedReason,
    );
    if (!row) return jsonError("NOT_FOUND", "Template not found", 404);
    return jsonOk({ template: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update approval", 500);
  }
}
