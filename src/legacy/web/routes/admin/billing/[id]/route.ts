import { adminGetBillingRecord } from "@/lib/admin-billing/admin-billing-service";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const row = await adminGetBillingRecord(id);
    if (!row) {
      return jsonError("NOT_FOUND", "Billing record not found", 404);
    }
    return jsonOk(row);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load billing record", 500);
  }
}
