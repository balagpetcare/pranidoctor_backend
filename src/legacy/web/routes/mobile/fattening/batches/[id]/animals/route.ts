import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { addAnimalsToFatteningBatch } from "@/lib/mobile-fattening/fattening-service";
import { addFatteningBatchAnimalsBodySchema } from "@/lib/mobile-fattening/schemas";

type RouteParams = { params: Promise<{ id: string }> };

function mapServiceError(e: unknown) {
  if (!(e instanceof Error)) {
    return jsonError("DATABASE_ERROR", "Could not update batch animals", 500);
  }
  switch (e.message) {
    case "ANIMAL_NOT_FOUND":
      return jsonError("NOT_FOUND", "Animal not found", 404);
    case "ANIMAL_TYPE_NOT_SUPPORTED":
      return jsonError(
        "ANIMAL_TYPE_NOT_SUPPORTED",
        "Only cattle can be added to fattening batches",
        422,
      );
    case "BATCH_NOT_DRAFT":
      return jsonError("BATCH_NOT_DRAFT", "Batch is not in draft status", 409);
    default:
      return jsonError("DATABASE_ERROR", "Could not update batch animals", 500);
  }
}

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

  const parsed = addFatteningBatchAnimalsBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid animals payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const detail = await addAnimalsToFatteningBatch(
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
