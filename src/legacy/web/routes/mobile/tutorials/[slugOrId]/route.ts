import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialPublicDto } from "@/lib/knowledge-hub/dto";
import { getPublishedTutorialBySlugOrId } from "@/lib/knowledge-hub/service";

type RouteContext = { params: Promise<{ slugOrId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slugOrId } = await context.params;
  const decoded = decodeURIComponent(slugOrId).trim();
  if (!decoded) {
    return jsonError("VALIDATION_ERROR", "Missing tutorial slug or id", 422);
  }

  try {
    const post = await getPublishedTutorialBySlugOrId(decoded);
    if (!post) {
      return jsonError("NOT_FOUND", "Tutorial not found", 404);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(post) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load tutorial", 500);
  }
}
