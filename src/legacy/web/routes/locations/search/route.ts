import { jsonError, jsonOk } from "@/lib/api-response";
import { searchLocationsMaster } from "@/lib/locations/location-master-service";
import { locationSearchQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = {
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
  };
  const parsed = locationSearchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }
  try {
    const items = await searchLocationsMaster(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Search failed", 500);
  }
}
