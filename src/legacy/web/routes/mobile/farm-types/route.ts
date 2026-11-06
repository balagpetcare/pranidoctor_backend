import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { listActiveFarmCatalog } from "@/lib/mobile-farms/catalog-service";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const types = await listActiveFarmCatalog();
    return jsonOk({ types });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load farm types", 500);
  }
}
