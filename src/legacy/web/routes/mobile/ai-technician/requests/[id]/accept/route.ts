import { jsonError, jsonOk } from "@/lib/api-response";
import { acceptTechnicianAiServiceRequest } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const result = await acceptTechnicianAiServiceRequest({
      technicianProfileId: auth.ctx.technicianProfileId,
      id,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
      }
      if (result.code === "INVALID_STATUS") {
        return jsonError(
          "INVALID_STATUS",
          "এই অবস্থায় গ্রহণ করা যাবে না",
          409,
        );
      }
      if (result.code === "FORBIDDEN") {
        return jsonError("FORBIDDEN", "অন্য টেকনিশিয়ানের অনুরোধ", 403);
      }
      if (result.code === "AREA_MISMATCH") {
        return jsonError("AREA_MISMATCH", "এই এলাকার অনুরোধ নয়", 403);
      }
    }
    return jsonOk({ request: result.request });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
