import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getAnimalForCustomer,
  patchAnimalForCustomer,
} from "@/lib/mobile-animals/animal-service";
import { patchAnimalBodySchema } from "@/lib/mobile-animals/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const animal = await getAnimalForCustomer(auth.ctx.customerProfileId, id);
    if (!animal) {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonOk({ animal });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load animal", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchAnimalBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid animal payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const animal = await patchAnimalForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    if (!animal) {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    return jsonOk({ animal });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update animal", 500);
  }
}
