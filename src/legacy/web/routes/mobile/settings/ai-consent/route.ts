import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getAiConsentDocumentForUser } from "@/lib/mobile-settings/mobile-settings-service";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await getAiConsentDocumentForUser(auth.ctx.userId);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load AI consent", 500);
  }
}
