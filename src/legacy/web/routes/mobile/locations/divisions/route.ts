import { jsonError, jsonOk } from "@/lib/api-response";
import { listDivisionsForMobile } from "@/lib/mobile-locations/locations-service";

export async function GET() {
  try {
    const items = await listDivisionsForMobile();
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "বিভাগের তালিকা লোড করা যায়নি", 500);
  }
}
