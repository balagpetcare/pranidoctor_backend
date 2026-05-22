import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { chartsMilkForCustomer } from "@/lib/mobile-milk/milk-service";
import { milkChartsQuerySchema } from "@/lib/mobile-milk/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = milkChartsQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
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
    const charts = await chartsMilkForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ charts });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load milk charts", 500);
  }
}
