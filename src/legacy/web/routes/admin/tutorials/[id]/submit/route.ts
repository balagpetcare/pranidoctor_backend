import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialPublicDto } from "@/lib/knowledge-hub/dto";
import { submitTutorialAsAuthor } from "@/lib/knowledge-hub/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await submitTutorialAsAuthor(auth.actor.id, id);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "Tutorial not found", 404);
      }
      if (result.code === "INVALID_STATE") {
        return jsonError(
          "INVALID_STATE",
          "Only draft or rejected tutorials can be submitted for review",
          409,
        );
      }
      return jsonError("DATABASE_ERROR", "Could not submit tutorial", 500);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(result.post) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not submit tutorial", 500);
  }
}
