import { jsonError, jsonOk } from "@/lib/api-response";
import { completeTechnicianAiServiceRequest } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { completeAiServiceRequestBodySchema } from "@/lib/mobile-ai-technician/technician-ai-requests-schemas";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422);
  }

  const parsed = completeAiServiceRequestBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await completeTechnicianAiServiceRequest({
      technicianProfileId: auth.ctx.technicianProfileId,
      id,
      body: parsed.data,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
      }
      if (result.code === "FORBIDDEN") {
        return jsonError("FORBIDDEN", "অন্য টেকনিশিয়ানের অনুরোধ", 403);
      }
      if (result.code === "INVALID_STATUS") {
        return jsonError(
          "INVALID_STATUS",
          "সম্পূর্ণ করার আগে কাজ শুরুর অবস্থায় আনুন",
          409,
        );
      }
      if (result.code === "ALREADY_COMPLETED") {
        return jsonError("ALREADY_COMPLETED", "ইতিমধ্যে সম্পন্ন", 409);
      }
      if (result.code === "INVALID_FEE") {
        return jsonError("INVALID_FEE", "ফি সঠিক নয়", 422);
      }
    }
    return jsonOk({ request: result.request, record: result.record });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
