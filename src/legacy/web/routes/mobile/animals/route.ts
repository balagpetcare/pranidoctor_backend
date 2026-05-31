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
    const result = await createAnimalForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk(result, { status: 201 });
  } catch (e) {
    return mapAnimalWeightError(e) ?? jsonError("DATABASE_ERROR", "Could not create animal", 500);
  }
}

function mapAnimalWeightError(e: unknown) {
  if (!(e instanceof Error)) return null;
  if (e.message === "TAPE_NOT_SUPPORTED") {
    return jsonError("TAPE_NOT_SUPPORTED", "Tape weight not supported for this species", 422);
  }
  if (e.message === "TAPE_OUT_OF_RANGE") {
    return jsonError("VALIDATION_ERROR", "Measurements out of valid range", 422);
  }
  if (e.message === "DUPLICATE_CLIENT_MEASUREMENT") {
    const existing = (e as Error & { existing?: unknown }).existing;
    return jsonError("DUPLICATE_CLIENT_MEASUREMENT", "Measurement already recorded", 409, {
      existing,
    });
  }
  return null;
}
