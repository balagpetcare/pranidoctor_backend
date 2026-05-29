import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getVendorsService, mapVendorsError } from "../../../../../modules/vendors/index.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(_request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const vendor = await getVendorsService().getVendorWithProducts(id);
    return jsonOk({ vendor });
  } catch (e) {
    const mapped = mapVendorsError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not load vendor", 500);
  }
}
