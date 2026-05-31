import { jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getWeightAccuracyForAnimal } from "@/lib/mobile-animals/animal-weight-service";
import { mapAnimalWeightRouteError } from "@/lib/mobile-animals/animal-weight-route.util";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const windowDays = Number.parseInt(url.searchParams.get("windowDays") ?? "90", 10);

  try {
    const accuracy = await getWeightAccuracyForAnimal(
      auth.ctx.customerProfileId,
      id,
      Number.isFinite(windowDays) ? windowDays : 90,
    );
    return jsonOk({ accuracy });
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}
