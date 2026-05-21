import { rejectServiceRequestForDoctor } from "@/lib/doctor-service-requests/doctor-service-request-service";
import { doctorRejectRequestBodySchema } from "@/lib/doctor-service-requests/schemas";
import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = doctorRejectRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid request body",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await rejectServiceRequestForDoctor(
      auth.actor.doctorProfileId,
      id,
      parsed.data.reason,
    );

    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    if (result.ok === "INVALID_STATUS") {
      return jsonError(
        "INVALID_STATUS",
        "This request cannot be rejected in its current state",
        409,
        { status: result.status },
      );
    }

    const meta =
      result.ok === "ALREADY_REJECTED"
        ? ({ alreadyRejected: true } as const)
        : ({ alreadyRejected: false } as const);

    return jsonOk({
      request: result.request,
      meta,
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update service request", 500);
  }
}
