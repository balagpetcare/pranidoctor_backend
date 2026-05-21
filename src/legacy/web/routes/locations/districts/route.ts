import { jsonError, jsonOk } from "@/lib/api-response";
import { listDistrictsMaster } from "@/lib/locations/location-master-service";
import { listDistrictsQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = { divisionId: url.searchParams.get("divisionId") ?? undefined };
  const parsed = listDistrictsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }
  try {
    const items = await listDistrictsMaster(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load districts", 500);
  }
}
