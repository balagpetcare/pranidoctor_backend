import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createFatteningBatchForCustomer,
  listFatteningBatchesForCustomer,
} from "@/lib/mobile-fattening/fattening-service";
import {
  createFatteningBatchBodySchema,
  listFatteningBatchesQuerySchema,
} from "@/lib/mobile-fattening/schemas";

function mapServiceError(e: unknown) {
  if (!(e instanceof Error)) {
    return jsonError("DATABASE_ERROR", "Could not process fattening batch", 500);
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
      return jsonError("DATABASE_ERROR", "Could not process fattening batch", 500);
  }
}

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listFatteningBatchesQuerySchema.safeParse({
    farmId: url.searchParams.get("farmId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await listFatteningBatchesForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load fattening batches", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createFatteningBatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid batch payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const batch = await createFatteningBatchForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ batch });
  } catch (e) {
    return mapServiceError(e);
  }
}
