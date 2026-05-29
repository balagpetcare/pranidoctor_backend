import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getVendorsService,
  mapVendorsError,
  mobileVendorListQuerySchema,
} from "../../../../modules/vendors/index.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = mobileVendorListQuerySchema.safeParse({
    districtId: url.searchParams.get("districtId") ?? undefined,
    search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getVendorsService().listVerifiedVendors(parsed.data);
    return jsonOk(result);
  } catch (e) {
    const mapped = mapVendorsError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list vendors", 500);
  }
}
