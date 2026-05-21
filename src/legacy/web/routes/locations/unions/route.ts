import { jsonError, jsonOk } from "@/lib/api-response";
import { listUnionsMaster } from "@/lib/locations/location-master-service";
import { listUnionsQuerySchema } from "@/lib/locations/location-master-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = { upazilaId: url.searchParams.get("upazilaId") ?? undefined };
  const parsed = listUnionsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }
  try {
    const items = await listUnionsMaster(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load unions", 500);
  }
}
