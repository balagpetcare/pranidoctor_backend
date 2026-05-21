import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialListItemDto, toTutorialPublicDto } from "@/lib/knowledge-hub/dto";import {
  createTutorialBodySchema,
  doctorListTutorialsQuerySchema,
  parseSearchParams,
} from "@/lib/knowledge-hub/schemas";
import {
  createTutorialAsAuthor,
  listTutorialsForDoctorAuthor,
} from "@/lib/knowledge-hub/service";

export async function GET(request: Request) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = parseSearchParams(doctorListTutorialsQuerySchema, url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  const { take, skip, categoryId, approvalStatus } = parsed.data;

  try {
    const { tutorials, total } = await listTutorialsForDoctorAuthor({
      authorId: auth.actor.userId,
      take,
      skip,
      categoryId,
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
  const auth = await requireDoctorApiActor();
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
    const result = await createTutorialAsAuthor(auth.actor.userId, {
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
