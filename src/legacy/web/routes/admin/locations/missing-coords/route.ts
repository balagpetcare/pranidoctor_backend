import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { listMissingCoords } from "@/lib/locations/location-master-admin";
import { adminLocationListQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const raw = {
    level: url.searchParams.get("level") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };
  const parsed = adminLocationListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const items = await listMissingCoords(parsed.data);
    return jsonOk({
      level: parsed.data.level,
      limit: parsed.data.limit,
      items,
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load report", 500);
  }
}
