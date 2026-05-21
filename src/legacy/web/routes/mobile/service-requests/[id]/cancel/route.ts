import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { cancelServiceRequestBodySchema } from "@/lib/mobile-service-requests/schemas";
import { cancelServiceRequestForCustomer } from "@/lib/mobile-service-requests/service-request-service";

type RouteContext = { params: Promise<{ id: string }> };

async function handleCancel(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = cancelServiceRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid cancel payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await cancelServiceRequestForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data.cancelReason,
    );

    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    if (result.ok === "NOT_CANCELLABLE") {
      return jsonError(
        "INVALID_STATE",
        "This request cannot be cancelled",
        409,
        { status: result.status },
      );
    }

    return jsonOk({ request: result.request });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not cancel service request", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleCancel(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleCancel(request, context);
}
