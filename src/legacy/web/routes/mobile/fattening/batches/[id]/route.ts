import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getFatteningBatchForCustomer } from "@/lib/mobile-fattening/fattening-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const detail = await getFatteningBatchForCustomer(
      auth.ctx.customerProfileId,
      id,
    );
    if (!detail) {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonOk(detail);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load fattening batch", 500);
  }
}
