import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createVaccineForCustomer,
  listVaccinesForCustomer,
} from "@/lib/mobile-vaccines/vaccine-service";
import {
  createVaccineBodySchema,
  listVaccineQuerySchema,
} from "@/lib/mobile-vaccines/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listVaccineQuerySchema.safeParse({
    animalId: url.searchParams.get("animalId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const result = await listVaccinesForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load vaccines", 500);
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

  const parsed = createVaccineBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid vaccine payload", 422, parsed.error.flatten());
  }

  try {
    const record = await createVaccineForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ record }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "ANIMAL_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not create vaccine record", 500);
  }
}
