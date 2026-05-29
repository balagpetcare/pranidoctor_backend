import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminGetPlatformLivestockStats } from "@/lib/admin-feed-ecosystem/livestock-stats-service";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const stats = await adminGetPlatformLivestockStats();
    return jsonOk({ stats });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load livestock statistics", 500);
  }
}
