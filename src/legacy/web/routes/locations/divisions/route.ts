import { jsonError, jsonOk } from "@/lib/api-response";
import { listDivisionsMaster } from "@/lib/locations/location-master-service";

export async function GET() {
  try {
    const items = await listDivisionsMaster();
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load divisions", 500);
  }
}
