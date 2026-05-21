import { jsonError, jsonOk } from "@/lib/api-response";
import { updateTechnicianAiServiceRequestStatus } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { postAiServiceRequestStatusBodySchema } from "@/lib/mobile-ai-technician/technician-ai-requests-schemas";
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

  const parsed = postAiServiceRequestStatusBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await updateTechnicianAiServiceRequestStatus({
      technicianProfileId: auth.ctx.technicianProfileId,
      id,
      status: parsed.data.status,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
      }
      if (result.code === "FORBIDDEN") {
        return jsonError("FORBIDDEN", "অন্য টেকনিশিয়ানের অনুরোধ", 403);
      }
      if (result.code === "INVALID_TRANSITION") {
        return jsonError(
          "INVALID_TRANSITION",
          "পরবর্তী ধাপে যাওয়া যাবে না",
          409,
        );
      }
    }
    return jsonOk({ request: result.request });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
