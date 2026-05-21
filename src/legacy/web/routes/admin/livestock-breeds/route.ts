import { AnimalType } from "@/generated/prisma/client";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminCreateLivestockBreed, adminListLivestockBreeds } from "@/lib/admin-semen/breeds-service";
import {
  createLivestockBreedBodySchema,
  listLivestockBreedsQuerySchema,
} from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listLivestockBreedsQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    animalType: url.searchParams.get("animalType") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  const isActive =
    parsed.data.isActive === "true"
      ? true
      : parsed.data.isActive === "false"
        ? false
        : undefined;

  try {
    const data = await adminListLivestockBreeds({
      ...parsed.data,
      isActive,
      animalType: parsed.data.animalType as AnimalType | undefined,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load breeds", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createLivestockBreedBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const row = await adminCreateLivestockBreed(parsed.data);
    return jsonOk({ breed: row }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not create breed", 500);
  }
}
