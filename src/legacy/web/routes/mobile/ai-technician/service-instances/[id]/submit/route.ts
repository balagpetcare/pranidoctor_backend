import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { mobileSubmitServiceInstance } from "@/lib/service-instances/mobile-service-instance-service";
import { getClientRequestMeta } from "@/lib/service-instances/request-meta";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const meta = getClientRequestMeta(request);

  const result = await mobileSubmitServiceInstance(
    auth.ctx.userId,
    auth.ctx.technicianProfileId,
    id,
    meta,
  );
  if (result.ok === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "খুঁজে পাওয়া যায়নি", 404);
  }
  if (result.ok === "NOT_SUBMITTABLE") {
    return jsonError("NOT_SUBMITTABLE", "জমা দেওয়া যাবে না", 409, {
      status: result.status,
    });
  }
  if (result.ok === "TEMPLATE_INACTIVE") {
    return jsonError("TEMPLATE_INACTIVE", "টেমপ্লেট নিষ্ক্রিয়", 409);
  }
  if (result.ok === "VALIDATION") {
    return jsonError("VALIDATION_ERROR", "যাচাইকরণ ব্যর্থ", 422, {
      issues: result.issues,
    });
  }
  if (result.ok === "INVALID_TRANSITION") {
    return jsonError("INVALID_TRANSITION", result.message, 409);
  }
  return jsonOk({
    instance: result.instance,
    duplicateWarning: result.duplicateWarning,
  });
}
