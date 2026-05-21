import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createAnimalForCustomer,
  listAnimalsForCustomer,
} from "@/lib/mobile-animals/animal-service";
import {
  createAnimalBodySchema,
  listAnimalsQuerySchema,
} from "@/lib/mobile-animals/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listAnimalsQuerySchema.safeParse({
    includeInactive: url.searchParams.get("includeInactive") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const animals = await listAnimalsForCustomer(
      auth.ctx.customerProfileId,
      parsed.data.includeInactive,
    );
    return jsonOk({ animals });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load animals", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createAnimalBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid animal payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const animal = await createAnimalForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ animal }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not create animal", 500);
  }
}
