import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createSupportTicketForCustomer,
  listSupportTicketsForCustomer,
} from "@/lib/mobile-support/support-service";
import {
  createSupportTicketBodySchema,
  listSupportTicketsQuerySchema,
} from "@/lib/mobile-support/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listSupportTicketsQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const result = await listSupportTicketsForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load support tickets", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createSupportTicketBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid ticket payload", 422, parsed.error.flatten());
  }

  try {
    const ticket = await createSupportTicketForCustomer(
      auth.ctx.customerProfileId,
      auth.ctx.userId,
      parsed.data,
      request,
    );
    return jsonOk({ ticket }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_ATTACHMENTS") {
      return jsonError("VALIDATION_ERROR", "One or more attachments are invalid", 422);
    }
    return jsonError("DATABASE_ERROR", "Could not create support ticket", 500);
  }
}
