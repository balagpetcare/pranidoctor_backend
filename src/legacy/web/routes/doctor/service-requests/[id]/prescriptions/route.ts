import { createDoctorPrescriptionBodySchema } from "@/lib/doctor-service-requests/clinical-schemas";
import { createPrescriptionForDoctor } from "@/lib/doctor-service-requests/doctor-clinical-service";
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
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createDoctorPrescriptionBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid prescription payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createPrescriptionForDoctor(
      auth.actor.doctorProfileId,
      id,
      parsed.data,
    );

    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    if (result.ok === "INVALID_STATUS") {
      return jsonError(
        "INVALID_STATUS",
        "Prescriptions cannot be added for this request in its current state",
        409,
        { status: result.status },
      );
    }

    if (result.ok !== "CREATED") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    return jsonOk({ prescription: result.prescription });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not save prescription", 500);
  }
}
