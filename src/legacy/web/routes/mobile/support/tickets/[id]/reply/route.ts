import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { replySupportTicketForCustomer } from "@/lib/mobile-support/support-service";
import { replySupportTicketBodySchema } from "@/lib/mobile-support/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = replySupportTicketBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid reply payload", 422, parsed.error.flatten());
  }

  try {
    const ticket = await replySupportTicketForCustomer(
      auth.ctx.customerProfileId,
      auth.ctx.userId,
      id,
      parsed.data,
      request,
    );
    if (!ticket) {
      return jsonError("NOT_FOUND", "Support ticket not found", 404);
    }
    return jsonOk({ ticket }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "TICKET_CLOSED") {
      return jsonError("TICKET_CLOSED", "Cannot reply to a closed ticket", 409);
    }
    if (e instanceof Error && e.message === "INVALID_ATTACHMENTS") {
      return jsonError("VALIDATION_ERROR", "One or more attachments are invalid", 422);
    }
    return jsonError("DATABASE_ERROR", "Could not send reply", 500);
  }
}
