import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createLivestockSchema,
  getLivestockController,
  listLivestockQuerySchema,
  mapLivestockError,
} from "../../../../modules/livestock/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listLivestockQuerySchema.safeParse({
    farmRef: url.searchParams.get("farmRef") ?? undefined,
    species: url.searchParams.get("species") ?? undefined,
    lifecycleStatus: url.searchParams.get("lifecycleStatus") ?? url.searchParams.get("status") ?? undefined,
    gender: url.searchParams.get("gender") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortOrder: url.searchParams.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getLivestockController().list(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list livestock", 500);
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

  const parsed = createLivestockSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid livestock payload", 422, parsed.error.flatten());
  }

  try {
    const livestock = await getLivestockController().create(
      auth.ctx.customerProfileId,
      parsed.data,
      auth.ctx.userId,
    );
    return jsonOk({ livestock }, { status: 201 });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not create livestock", 500);
  }
}
