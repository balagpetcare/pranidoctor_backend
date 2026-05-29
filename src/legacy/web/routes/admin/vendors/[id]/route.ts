import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  getVendorsRepository,
  getVendorsService,
  updateVendorBodySchema,
  mapVendorsError,
  toVendorWithProductsDto,
} from "../../../../../modules/vendors/index.js";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  try {
    const row = await getVendorsRepository().findVendorWithProducts(id);
    if (!row) return jsonError("NOT_FOUND", "Vendor not found", 404);
    return jsonOk({ vendor: toVendorWithProductsDto(row) });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load vendor", 500);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = updateVendorBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const vendor = await getVendorsService().updateVendor(id, parsed.data);
    return jsonOk({ vendor });
  } catch (e) {
    const mapped = mapVendorsError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not update vendor", 500);
  }
}
