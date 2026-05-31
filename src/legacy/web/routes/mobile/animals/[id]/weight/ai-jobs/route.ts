import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { createAiJobForAnimal } from "@/lib/mobile-animals/animal-weight-service";
import { createAiJobBodySchema } from "@/lib/mobile-animals/animal-weight-schemas";
import { mapAnimalWeightRouteError } from "@/lib/mobile-animals/animal-weight-route.util";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createAiJobBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid AI job payload", 422, parsed.error.flatten());
  }

  try {
    const result = await createAiJobForAnimal(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    return jsonOk(result, { status: 201 });
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}
