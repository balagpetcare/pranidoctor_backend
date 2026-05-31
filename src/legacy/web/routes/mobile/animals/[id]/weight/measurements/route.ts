import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createMeasurementForAnimal,
  listMeasurementsForAnimal,
} from "@/lib/mobile-animals/animal-weight-service";
import {
  createMeasurementBodySchema,
  listMeasurementsQuerySchema,
} from "@/lib/mobile-animals/animal-weight-schemas";
import { mapAnimalWeightRouteError } from "@/lib/mobile-animals/animal-weight-route.util";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const parsed = listMeasurementsQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    method: url.searchParams.get("method") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await listMeasurementsForAnimal(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    return jsonOk(result);
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}

export async function POST(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createMeasurementBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid weight payload", 422, parsed.error.flatten());
  }

  try {
    const result = await createMeasurementForAnimal(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    return jsonOk(result, { status: 201 });
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}
