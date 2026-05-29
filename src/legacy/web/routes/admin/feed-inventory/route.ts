import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminListFeedInventory } from "@/lib/admin-feed-ecosystem/inventory-monitor-service";
import { inventoryMonitorQuerySchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = inventoryMonitorQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
    lowStockOnly: url.searchParams.get("lowStockOnly") ?? undefined,
    farmRef: url.searchParams.get("farmRef") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const result = await adminListFeedInventory(parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load inventory monitor data", 500);
  }
}
