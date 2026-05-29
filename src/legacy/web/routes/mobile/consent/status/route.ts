import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getConsentStatusForUser } from "@/lib/mobile-settings/consent-service";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const status = await getConsentStatusForUser(auth.ctx.userId);
    return jsonOk(status);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load consent status", 500);
  }
}
