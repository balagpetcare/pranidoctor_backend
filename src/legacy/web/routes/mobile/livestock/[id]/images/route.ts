import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createLivestockImageSchema,
  getLivestockController,
  mapLivestockError,
} from "../../../../../../modules/livestock/index.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(_request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const images = await getLivestockController().listImages(auth.ctx.customerProfileId, id);
    return jsonOk({ images });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not load images", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createLivestockImageSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid image payload", 422, parsed.error.flatten());
  }

  try {
    const image = await getLivestockController().addImage(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    return jsonOk({ image }, { status: 201 });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not add image", 500);
  }
}
