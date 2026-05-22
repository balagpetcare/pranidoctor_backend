import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getSupportTicketForCustomer,
  patchSupportTicketForCustomer,
} from "@/lib/mobile-support/support-service";
import { patchSupportTicketBodySchema } from "@/lib/mobile-support/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const ticket = await getSupportTicketForCustomer(auth.ctx.customerProfileId, id);
    if (!ticket) {
      return jsonError("NOT_FOUND", "Support ticket not found", 404);
    }
    return jsonOk({ ticket });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load support ticket", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchSupportTicketBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid patch payload", 422, parsed.error.flatten());
  }

  try {
    const ticket = await patchSupportTicketForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    if (!ticket) {
      return jsonError("NOT_FOUND", "Support ticket not found", 404);
    }
    return jsonOk({ ticket });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update support ticket", 500);
  }
}
