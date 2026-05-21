import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialPublicDto } from "@/lib/knowledge-hub/dto";
import { updateTutorialBodySchema } from "@/lib/knowledge-hub/schemas";
import {
  getTutorialForDoctorAuthor,
  updateTutorialAsAuthor,
} from "@/lib/knowledge-hub/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const post = await getTutorialForDoctorAuthor(auth.actor.userId, id);
    if (!post) {
      return jsonError("NOT_FOUND", "Tutorial not found", 404);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(post) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load tutorial", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = updateTutorialBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid tutorial payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await updateTutorialAsAuthor(auth.actor.userId, id, {
      ...parsed.data,
      summary:
        parsed.data.summary === undefined ? undefined : parsed.data.summary,
      coverImageUrl:
        parsed.data.coverImageUrl === undefined
          ? undefined
          : parsed.data.coverImageUrl,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "Tutorial not found", 404);
      }
      if (result.code === "NOT_EDITABLE") {
        return jsonError(
          "NOT_EDITABLE",
          "Only draft, pending review, or rejected tutorials can be edited",
          409,
        );
      }
      if (result.code === "CATEGORY_NOT_FOUND") {
        return jsonError("CATEGORY_NOT_FOUND", "Category does not exist", 404);
      }
      if (result.code === "SLUG_TAKEN") {
        return jsonError("SLUG_TAKEN", "Slug is already in use", 409);
      }
      return jsonError("DATABASE_ERROR", "Could not update tutorial", 500);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(result.post) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update tutorial", 500);
  }
}
