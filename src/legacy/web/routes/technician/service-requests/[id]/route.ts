import { jsonError, jsonOk } from "@/lib/api-response";
import { requireTechnicianApiActor } from "@/lib/technician-auth/api-guard";
import { getServiceRequestDetailForTechnician } from "@/lib/technician-service-requests/technician-service-request-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTechnicianApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const requestRow = await getServiceRequestDetailForTechnician(
      auth.actor.aiTechnicianProfileId,
      id,
    );
    if (!requestRow) {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }
    return jsonOk({ request: requestRow });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service request", 500);
  }
}
