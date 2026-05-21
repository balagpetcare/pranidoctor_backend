import { jsonError, jsonOk } from "@/lib/api-response";
import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { listServiceRequestsForDoctor } from "@/lib/doctor-service-requests/doctor-service-request-service";
import { parseDoctorListServiceRequestsQuery } from "@/lib/doctor-service-requests/schemas";

export async function GET(request: Request) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;
  const { actor } = auth;

  const url = new URL(request.url);
  const parsed = parseDoctorListServiceRequestsQuery(url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await listServiceRequestsForDoctor(actor.doctorProfileId, parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service requests", 500);
  }
}
