import { jsonError, jsonOk } from "@/lib/api-response";
import { declineTechnicianAiServiceRequest } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { declineAiServiceRequestBodySchema } from "@/lib/mobile-ai-technician/technician-ai-requests-schemas";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const body = await request.json().catch(() => ({}));
  const parsed = declineAiServiceRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }
  const reason = parsed.data.reason;

  try {
    const result = await declineTechnicianAiServiceRequest({
      technicianProfileId: auth.ctx.technicianProfileId,
      id,
      reason,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
      }
      if (result.code === "INVALID_STATUS") {
        return jsonError(
          "INVALID_STATUS",
          "এই অবস্থায় বাতিল করা যাবে না",
          409,
        );
      }
      if (result.code === "FORBIDDEN") {
        return jsonError("FORBIDDEN", "অন্য টেকনিশিয়ানের অনুরোধ", 403);
      }
    }
    return jsonOk({ request: result.request });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
