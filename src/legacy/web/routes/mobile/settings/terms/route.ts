import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getTermsDocumentForUser } from "@/lib/mobile-settings/mobile-settings-service";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await getTermsDocumentForUser(auth.ctx.userId);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load terms of service", 500);
  }
}
