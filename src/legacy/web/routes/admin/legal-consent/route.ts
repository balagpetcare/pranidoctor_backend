import { listLegalConsentEvents } from "@/lib/mobile-settings/legal-consent-audit";
import { adminLegalConsentQuerySchema } from "@/lib/admin-legal/schemas";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = adminLegalConsentQuerySchema.safeParse({
    consentType: url.searchParams.get("consentType") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const data = await listLegalConsentEvents(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load consent audit", 500);
  }
}
