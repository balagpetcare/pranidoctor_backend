import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  deleteVaccineForCustomer,
  getVaccineForCustomer,
  patchVaccineForCustomer,
} from "@/lib/mobile-vaccines/vaccine-service";
import { patchVaccineBodySchema } from "@/lib/mobile-vaccines/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const record = await getVaccineForCustomer(auth.ctx.customerProfileId, id);
    if (!record) return jsonError("NOT_FOUND", "Vaccine record not found", 404);
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load vaccine record", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchVaccineBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid vaccine payload", 422, parsed.error.flatten());
  }

  try {
    const record = await patchVaccineForCustomer(auth.ctx.customerProfileId, id, parsed.data);
    if (!record) return jsonError("NOT_FOUND", "Vaccine record not found", 404);
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update vaccine record", 500);
  }
}

export async function DELETE(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const deleted = await deleteVaccineForCustomer(auth.ctx.customerProfileId, id);
    if (!deleted) return jsonError("NOT_FOUND", "Vaccine record not found", 404);
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not delete vaccine record", 500);
  }
}
