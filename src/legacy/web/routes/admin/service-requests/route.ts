import {
  adminListServiceRequests,
} from "@/lib/admin-service-requests/service-request-admin-service";
import { parseAdminListServiceRequestsQuery } from "@/lib/admin-service-requests/schemas";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = parseAdminListServiceRequestsQuery(url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await adminListServiceRequests(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service requests", 500);
  }
}
