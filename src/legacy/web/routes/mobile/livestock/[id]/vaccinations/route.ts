import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createVaccinationBodySchema,
  getLivestockHealthService,
  mapLivestockHealthError,
  vaccinationListQuerySchema,
} from "../../../../../../modules/livestock-health/index.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const url = new URL(request.url);
  const parsed = vaccinationListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getLivestockHealthService().listVaccinations(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    return jsonOk(result);
  } catch (e) {
    const mapped = mapLivestockHealthError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list vaccinations", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createVaccinationBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid vaccination", 422, parsed.error.flatten());
  }

  try {
    const vaccination = await getLivestockHealthService().createVaccination(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk({ vaccination }, { status: 201 });
  } catch (e) {
    const mapped = mapLivestockHealthError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not create vaccination", 500);
  }
}
