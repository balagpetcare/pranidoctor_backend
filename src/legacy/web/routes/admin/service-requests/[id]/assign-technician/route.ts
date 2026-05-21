import {
  assignTechnicianToServiceRequest,
} from "@/lib/admin-service-requests/service-request-assignment-service";
import {
  adminAssignTechnicianBodySchema,
} from "@/lib/admin-service-requests/schemas";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = adminAssignTechnicianBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await assignTechnicianToServiceRequest(
      id,
      parsed.data.aiTechnicianProfileId,
    );

    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }
    if (result.ok === "INVALID_TECHNICIAN") {
      return jsonError(
        "INVALID_TECHNICIAN",
        "Technician not found or not eligible for assignment",
        422,
      );
    }
    if (result.ok === "TERMINAL_STATUS") {
      return jsonError(
        "INVALID_STATUS",
        "Cannot assign on a closed service request",
        409,
        { status: result.status },
      );
    }
    if (result.ok === "INVALID_TRANSITION") {
      return jsonError(
        "INVALID_TRANSITION",
        "This request cannot be assigned to that technician in its current state",
        409,
        { status: result.status },
      );
    }

    return jsonOk({ request: result.request });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not assign technician", 500);
  }
}
