import { adminGetServiceRequest } from "@/lib/admin-service-requests/service-request-admin-service";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const requestRow = await adminGetServiceRequest(id);
    if (!requestRow) {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }
    return jsonOk({ request: requestRow });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service request", 500);
  }
}
