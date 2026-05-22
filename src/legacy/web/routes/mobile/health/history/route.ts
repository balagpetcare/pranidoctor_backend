import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createHealthForCustomer,
  listHealthHistoryForCustomer,
} from "@/lib/mobile-health/health-service";
import {
  createHealthBodySchema,
  listHealthQuerySchema,
} from "@/lib/mobile-health/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listHealthQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    animalId: url.searchParams.get("animalId") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const result = await listHealthHistoryForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load health history", 500);
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

  const parsed = createHealthBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid health payload", 422, parsed.error.flatten());
  }

  try {
    const record = await createHealthForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ record }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "ANIMAL_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not create health record", 500);
  }
}
