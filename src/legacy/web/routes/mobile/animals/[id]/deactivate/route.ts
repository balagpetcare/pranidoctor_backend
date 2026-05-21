import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { deactivateAnimalForCustomer } from "@/lib/mobile-animals/animal-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const animal = await deactivateAnimalForCustomer(
      auth.ctx.customerProfileId,
      id,
    );
    if (!animal) {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonOk({ animal });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not deactivate animal", 500);
  }
}
