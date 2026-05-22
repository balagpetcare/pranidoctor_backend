import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { summaryMilkForCustomer } from "@/lib/mobile-milk/milk-service";
import { milkSummaryQuerySchema } from "@/lib/mobile-milk/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = milkSummaryQuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
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
    const summary = await summaryMilkForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ summary });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load milk summary", 500);
  }
}
