import { jsonError, jsonOk } from "@/lib/api-response";
import { requireTechnicianApiActor } from "@/lib/technician-auth/api-guard";
import { parseTechnicianListServiceRequestsQuery } from "@/lib/technician-service-requests/schemas";
import { listServiceRequestsForTechnician } from "@/lib/technician-service-requests/technician-service-request-service";

export async function GET(request: Request) {
  const auth = await requireTechnicianApiActor();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = parseTechnicianListServiceRequestsQuery(url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await listServiceRequestsForTechnician(
      auth.actor.aiTechnicianProfileId,
      parsed.data,
    );
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service requests", 500);
  }
}
