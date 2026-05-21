import {
  getServiceRequestDetailForDoctor,
} from "@/lib/doctor-service-requests/doctor-service-request-service";
import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const requestRow = await getServiceRequestDetailForDoctor(
      auth.actor.doctorProfileId,
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
