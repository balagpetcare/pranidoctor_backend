import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialPublicDto } from "@/lib/knowledge-hub/dto";
import { approveTutorialAsAdmin } from "@/lib/knowledge-hub/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const result = await approveTutorialAsAdmin(id);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "Tutorial not found", 404);
      }
      if (result.code === "INVALID_STATE") {
        return jsonError(
          "INVALID_STATE",
          "Only tutorials pending review can be approved",
          409,
        );
      }
      return jsonError("DATABASE_ERROR", "Could not approve tutorial", 500);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(result.post) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not approve tutorial", 500);
  }
}
