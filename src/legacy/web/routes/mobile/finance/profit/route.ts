import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { profitForCustomer } from "@/lib/mobile-finance/finance-service";
import { financeRangeQuerySchema } from "@/lib/mobile-finance/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = financeRangeQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const profit = await profitForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ profit });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load profit summary", 500);
  }
}
