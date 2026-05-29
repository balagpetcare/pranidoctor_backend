import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  getVendorsService,
  verifyVendorBodySchema,
  mapVendorsError,
} from "../../../../../../modules/vendors/index.js";
import { jsonError, jsonOk } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = verifyVendorBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const vendor = await getVendorsService().verifyVendor(id, parsed.data.status);
    return jsonOk({ vendor });
  } catch (e) {
    const mapped = mapVendorsError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not verify vendor", 500);
  }
}
