import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getServiceRequestForCustomer } from "@/lib/mobile-service-requests/service-request-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const row = await getServiceRequestForCustomer(
      auth.ctx.customerProfileId,
      id,
    );
    if (!row) {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }
    return jsonOk({ request: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service request", 500);
  }
}
