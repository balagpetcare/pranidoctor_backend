import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminUpdateAiTechnicianComplaintStatus } from "@/lib/mobile-ai-services/ai-quality-service";
import { adminUpdateAiTechnicianComplaintBodySchema } from "@/lib/mobile-ai-services/ai-quality-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = adminUpdateAiTechnicianComplaintBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid body",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await adminUpdateAiTechnicianComplaintStatus({
      id,
      status: parsed.data.status,
      adminNote: parsed.data.adminNote,
    });
    if (!result.ok) {
      return jsonError("NOT_FOUND", "Complaint not found", 404);
    }
    return jsonOk({ complaint: result.complaint });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update complaint", 500);
  }
}
