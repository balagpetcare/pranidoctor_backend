import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAdminConsentOverview } from "@/lib/mobile-settings/consent-service";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const overview = await getAdminConsentOverview();
    return jsonOk(overview);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load consent overview", 500);
  }
}
