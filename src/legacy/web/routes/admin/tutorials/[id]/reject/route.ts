import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialPublicDto } from "@/lib/knowledge-hub/dto";
import { rejectTutorialBodySchema } from "@/lib/knowledge-hub/schemas";
import { rejectTutorialAsAdmin } from "@/lib/knowledge-hub/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = rejectTutorialBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid reject payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await rejectTutorialAsAdmin(id, parsed.data.reason);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "Tutorial not found", 404);
      }
      if (result.code === "INVALID_STATE") {
        return jsonError(
          "INVALID_STATE",
          "Only tutorials pending review can be rejected",
          409,
        );
      }
      return jsonError("DATABASE_ERROR", "Could not reject tutorial", 500);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(result.post) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not reject tutorial", 500);
  }
}
