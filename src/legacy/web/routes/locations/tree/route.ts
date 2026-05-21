import { jsonError, jsonOk } from "@/lib/api-response";
import { getLocationTree } from "@/lib/locations/location-master-service";
import { locationTreeQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = {
    divisionId: url.searchParams.get("divisionId") ?? undefined,
    districtId: url.searchParams.get("districtId") ?? undefined,
    upazilaId: url.searchParams.get("upazilaId") ?? undefined,
    unionId: url.searchParams.get("unionId") ?? undefined,
  };
  const parsed = locationTreeQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }
  try {
    const items = await getLocationTree(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to build tree", 500);
  }
}
