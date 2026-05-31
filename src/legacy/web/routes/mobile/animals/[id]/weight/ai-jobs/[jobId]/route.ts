import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getAiJobForCustomer } from "@/lib/mobile-animals/animal-weight-service";
import { mapAnimalWeightRouteError } from "@/lib/mobile-animals/animal-weight-route.util";

type RouteParams = { params: Promise<{ id: string; jobId: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { jobId } = await ctx.params;

  try {
    const result = await getAiJobForCustomer(auth.ctx.customerProfileId, jobId);
    if (!result) {
      return jsonError("NOT_FOUND", "AI job not found", 404);
    }
    return jsonOk(result);
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}
