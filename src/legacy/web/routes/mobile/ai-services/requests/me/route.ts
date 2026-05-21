import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { listMyAiServiceRequests } from "@/lib/mobile-ai-services/ai-services-service";
import { listMyAiServiceRequestsQuerySchema } from "@/lib/mobile-ai-services/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = listMyAiServiceRequestsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await listMyAiServiceRequests(auth.ctx.userId, parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "তালিকা লোড করা যায়নি", 500);
  }
}
