import { jsonError, jsonOk } from "@/lib/api-response";
import { toTutorialListItemDto } from "@/lib/knowledge-hub/dto";
import {
  listPublishedTutorials,
} from "@/lib/knowledge-hub/service";
import {
  parseSearchParams,
  publicListTutorialsQuerySchema,
} from "@/lib/knowledge-hub/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(publicListTutorialsQuerySchema, url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  const { take, skip, categoryId, categorySlug } = parsed.data;

  try {
    const { tutorials, total } = await listPublishedTutorials({
      take,
      skip,
      categoryId,
      categorySlug,
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
