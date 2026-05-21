import { jsonError, jsonOk } from "@/lib/api-response";
import { listVillagesMaster } from "@/lib/locations/location-master-service";
import { listVillagesQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = { unionId: url.searchParams.get("unionId") ?? undefined };
  const parsed = listVillagesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }
  try {
    const items = await listVillagesMaster(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load villages", 500);
  }
}
