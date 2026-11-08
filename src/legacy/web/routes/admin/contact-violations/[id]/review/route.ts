import { z } from "zod";
import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { reviewViolation } from "../../../../../../../modules/contact-guard/service.js";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    action: z.enum(["DISMISS", "CONFIRM", "RESTORE"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApiActor(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "JSON required", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError("VALIDATION_ERROR", "Invalid review payload", 422);
  try {
    const row = await reviewViolation(id, auth.actor.userId, parsed.data.action, parsed.data.note);
    if (!row) return jsonError("NOT_FOUND", "Violation not found", 404);
    return jsonOk({ violation: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not review violation", 500);
  }
}
