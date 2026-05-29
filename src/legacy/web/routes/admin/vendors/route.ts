import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  getVendorsService,
  createVendorBodySchema,
  adminVendorListQuerySchema,
  mapVendorsError,
} from "../../../../modules/vendors/index.js";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = adminVendorListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    verificationStatus: url.searchParams.get("verificationStatus") ?? undefined,
    districtId: url.searchParams.get("districtId") ?? undefined,
    search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
    activeOnly: url.searchParams.get("activeOnly") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await getVendorsService().listVendors(parsed.data);
    return jsonOk(result);
  } catch (e) {
    const mapped = mapVendorsError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not list vendors", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createVendorBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const vendor = await getVendorsService().createVendor(parsed.data);
    return jsonOk({ vendor }, { status: 201 });
  } catch (e) {
    const mapped = mapVendorsError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not create vendor", 500);
  }
}
