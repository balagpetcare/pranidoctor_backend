import {
  requireAdminApiActor,
  requireAdminPanelApiAccess,
} from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialListItemDto, toTutorialPublicDto } from "@/lib/knowledge-hub/dto";
import {
  adminListTutorialsQuerySchema,
  createTutorialBodySchema,
  parseSearchParams,
} from "@/lib/knowledge-hub/schemas";
import {
  createTutorialAsAuthor,
  listAllTutorialsForAdmin,
} from "@/lib/knowledge-hub/service";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = parseSearchParams(adminListTutorialsQuerySchema, url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  const { take, skip, categoryId, approvalStatus, authorId } = parsed.data;

  try {
    const { tutorials, total } = await listAllTutorialsForAdmin({
      take,
      skip,
      categoryId,
      authorId,
      approvalStatus,
    });
    return jsonOk({
      tutorials: tutorials.map(toTutorialListItemDto),
      total,
      take,
      skip,
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load tutorials", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createTutorialBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid tutorial payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createTutorialAsAuthor(auth.actor.id, {
      ...parsed.data,
      summary: parsed.data.summary ?? null,
      coverImageUrl: parsed.data.coverImageUrl ?? null,
    });
    if (!result.ok) {
      if (result.code === "CATEGORY_NOT_FOUND") {
        return jsonError("CATEGORY_NOT_FOUND", "Category does not exist", 404);
      }
      if (result.code === "SLUG_TAKEN") {
        return jsonError("SLUG_TAKEN", "Slug is already in use", 409);
      }
      return jsonError("DATABASE_ERROR", "Could not create tutorial", 500);
    }
    return jsonOk({ tutorial: toTutorialPublicDto(result.post) }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not create tutorial", 500);
  }
}
