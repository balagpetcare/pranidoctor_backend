import { jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getCurrentWeightForAnimal } from "@/lib/mobile-animals/animal-weight-service";
import { mapAnimalWeightRouteError } from "@/lib/mobile-animals/animal-weight-route.util";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const current = await getCurrentWeightForAnimal(auth.ctx.customerProfileId, id);
    return jsonOk({ current });
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}
