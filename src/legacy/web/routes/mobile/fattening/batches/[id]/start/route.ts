import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { startFatteningBatchForCustomer } from "@/lib/mobile-fattening/fattening-service";
import { startFatteningBatchBodySchema } from "@/lib/mobile-fattening/schemas";

type RouteParams = { params: Promise<{ id: string }> };

function mapServiceError(e: unknown) {
  if (!(e instanceof Error)) {
    return jsonError("DATABASE_ERROR", "Could not start fattening batch", 500);
  }
  switch (e.message) {
    case "BATCH_NOT_DRAFT":
      return jsonError("BATCH_NOT_DRAFT", "Batch is not in draft status", 409);
    case "BATCH_EMPTY":
      return jsonError("BATCH_EMPTY", "Add at least one animal before starting", 422);
    case "ANIMAL_ALREADY_IN_ACTIVE_BATCH":
      return jsonError(
        "ANIMAL_ALREADY_IN_ACTIVE_BATCH",
        "One or more animals are already in an active fattening batch",
        409,
      );
    case "INVALID_START_DATE":
      return jsonError("VALIDATION_ERROR", "Invalid start date", 422);
    case "INVALID_DATE":
      return jsonError("VALIDATION_ERROR", "Invalid date", 422);
    default:
      return jsonError("DATABASE_ERROR", "Could not start fattening batch", 500);
  }
}

export async function POST(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      json = JSON.parse(text);
    }
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = startFatteningBatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid start payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const detail = await startFatteningBatchForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    if (!detail) {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonOk(detail);
  } catch (e) {
    return mapServiceError(e);
  }
}
