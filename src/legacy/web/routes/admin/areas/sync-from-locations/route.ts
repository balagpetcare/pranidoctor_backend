import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { syncAreasFromLocations } from "@/lib/admin-areas/sync-from-locations";
import { jsonError, jsonOk } from "@/lib/api-response";

/** POST — build/refresh Area rows from the location master. Idempotent. */
export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let body: { pilotDistrictNames?: unknown } = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as { pilotDistrictNames?: unknown };
    } catch {
      return jsonError("INVALID_JSON", "Request body must be JSON", 400);
    }
  }

  const pilot =
    Array.isArray(body.pilotDistrictNames) && body.pilotDistrictNames.every((x) => typeof x === "string")
      ? (body.pilotDistrictNames as string[])
      : undefined;

  try {
    const report = await syncAreasFromLocations(pilot ? { pilotDistrictNames: pilot } : {});
    return jsonOk(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Area sync failed";
    return jsonError("AREA_SYNC_FAILED", message, 500);
  }
}
