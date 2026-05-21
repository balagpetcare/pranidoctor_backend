import { jsonError, jsonOk } from "@/lib/api-response";
import { listUpazilasMaster } from "@/lib/locations/location-master-service";
import { listUpazilasQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = { districtId: url.searchParams.get("districtId") ?? undefined };
  const parsed = listUpazilasQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }
  try {
    const items = await listUpazilasMaster(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load upazilas", 500);
  }
}
