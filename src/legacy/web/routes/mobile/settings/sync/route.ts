import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { syncMobileSettingsForUser } from "@/lib/mobile-settings/mobile-settings-service";
import { syncSettingsBodySchema } from "@/lib/mobile-settings/schemas";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = syncSettingsBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid sync payload", 422, parsed.error.flatten());
  }

  try {
    const result = await syncMobileSettingsForUser(auth.ctx.userId, parsed.data, request);
    return jsonOk(result, { status: 200 });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not sync settings", 500);
  }
}
