import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { timelineForCustomer } from "@/lib/mobile-health/health-service";
import { listHealthQuerySchema } from "@/lib/mobile-health/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listHealthQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    animalId: url.searchParams.get("animalId") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const timeline = await timelineForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ timeline });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load health timeline", 500);
  }
}
