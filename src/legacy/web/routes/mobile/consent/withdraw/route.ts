import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { withdrawConsentForUser } from "@/lib/mobile-settings/consent-service";

const bodySchema = z
  .object({
    consentType: z.enum(["PRIVACY", "TERMS", "AI_PROCESSING"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid withdraw payload", 422, parsed.error.flatten());
  }

  try {
    const status = await withdrawConsentForUser(
      auth.ctx.userId,
      parsed.data.consentType,
      request,
      parsed.data.reason,
    );
    return jsonOk(status);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not withdraw consent", 500);
  }
}
