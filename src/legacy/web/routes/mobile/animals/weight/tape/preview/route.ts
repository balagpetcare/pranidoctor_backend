import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { previewTapeWeight } from "@/lib/mobile-animals/animal-weight-service";
import { tapePreviewBodySchema } from "@/lib/mobile-animals/animal-weight-schemas";
import { mapAnimalWeightRouteError } from "@/lib/mobile-animals/animal-weight-route.util";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = tapePreviewBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid tape preview payload", 422, parsed.error.flatten());
  }

  try {
    const preview = await previewTapeWeight(parsed.data);
    return jsonOk({ preview });
  } catch (e) {
    return mapAnimalWeightRouteError(e);
  }
}
