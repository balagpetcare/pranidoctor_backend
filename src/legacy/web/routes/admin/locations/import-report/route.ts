import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { readLocationImportReport } from "@/lib/locations/location-master-admin";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;

  try {
    const report = readLocationImportReport();
    return jsonOk({ report });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to read import report", 500);
  }
}
