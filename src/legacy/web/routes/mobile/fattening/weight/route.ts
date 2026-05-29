import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createWeightRecordForCustomer,
  listWeightRecordsForCustomer,
} from "@/lib/mobile-fattening/weight-service";
import {
  createWeightBodySchema,
  listWeightQuerySchema,
} from "@/lib/mobile-fattening/weight-schemas";

function mapServiceError(e: unknown) {
  if (!(e instanceof Error)) {
    return jsonError("DATABASE_ERROR", "Could not process weight record", 500);
  }
  switch (e.message) {
    case "BATCH_NOT_FOUND":
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    case "BATCH_NOT_ACTIVE":
      return jsonError(
        "BATCH_NOT_ACTIVE",
        "Weight can only be recorded for active or completed batches",
        409,
      );
    case "ANIMAL_NOT_IN_BATCH":
      return jsonError("ANIMAL_NOT_IN_BATCH", "Animal is not in this batch", 422);
    case "INVALID_RECORDED_AT":
      return jsonError("VALIDATION_ERROR", "Invalid recordedAt", 422);
    case "DUPLICATE_WEIGHT_DAY":
      return jsonError(
        "DUPLICATE_WEIGHT_DAY",
        "A weight record already exists for this animal on this day",
        409,
      );
    default:
      return jsonError("DATABASE_ERROR", "Could not process weight record", 500);
  }
}

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listWeightQuerySchema.safeParse({
    batchId: url.searchParams.get("batchId"),
    animalId: url.searchParams.get("animalId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid weight list query",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await listWeightRecordsForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk(result);
  } catch (e) {
    return mapServiceError(e);
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

  const parsed = createWeightBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid weight payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const record = await createWeightRecordForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ record }, { status: 201 });
  } catch (e) {
    return mapServiceError(e);
  }
}
