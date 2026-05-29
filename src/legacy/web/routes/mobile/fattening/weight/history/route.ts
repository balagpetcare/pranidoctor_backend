import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { listWeightHistoryForCustomer } from "@/lib/mobile-fattening/weight-service";
import { listWeightQuerySchema } from "@/lib/mobile-fattening/weight-schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listWeightQuerySchema.safeParse({
    batchId: url.searchParams.get("batchId") ?? undefined,
    animalId: url.searchParams.get("animalId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
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
    const result = await listWeightHistoryForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk(result);
  } catch (e) {
    if (e instanceof Error && e.message === "BATCH_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Fattening batch not found", 404);
    }
    return jsonError("DATABASE_ERROR", "Could not load weight history", 500);
  }
}
