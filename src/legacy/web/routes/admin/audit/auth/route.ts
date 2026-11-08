import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { x, listAuthAudit } from "@/lib/admin-directory/service";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listAuthAuditQuerySchema.safeParse(Object.fromEntries(
    [...url.searchParams.entries()].filter(([, v]) => v !== ""),
  ));
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }
  try {
    return jsonOk(await listAuthAudit(parsed.data));
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load auth audit events", 500);
  }
}
