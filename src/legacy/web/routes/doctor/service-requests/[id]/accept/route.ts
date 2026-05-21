import { acceptServiceRequestForDoctor } from "@/lib/doctor-service-requests/doctor-service-request-service";
import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await acceptServiceRequestForDoctor(
      auth.actor.doctorProfileId,
      id,
    );

    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    if (result.ok === "INVALID_STATUS") {
      return jsonError(
        "INVALID_STATUS",
        "This request cannot be accepted in its current state",
        409,
        { status: result.status },
      );
    }

    const meta =
      result.ok === "ALREADY_ACCEPTED"
        ? ({ alreadyAccepted: true } as const)
        : ({ alreadyAccepted: false } as const);

    return jsonOk({
      request: result.request,
      meta,
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update service request", 500);
  }
}
