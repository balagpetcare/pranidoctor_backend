import { adminListBillingRecords } from "@/lib/admin-billing/admin-billing-service";
import { parseAdminBillingListQuery } from "@/lib/admin-billing/schemas";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = parseAdminBillingListQuery(url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await adminListBillingRecords(parsed.data);
    return jsonOk(data);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_DATE_RANGE") {
      return jsonError("VALIDATION_ERROR", "Invalid dateFrom / dateTo", 422);
    }
    return jsonError("DATABASE_ERROR", "Could not load billing records", 500);
  }
}
