import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getMyAiServiceRequestById } from "@/lib/mobile-ai-services/ai-services-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const row = await getMyAiServiceRequestById(auth.ctx.userId, id);
    if (!row) {
      return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
    }
    return jsonOk({ request: row });
  } catch {
    return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
  }
}
