import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { getAiServiceRecordForRequestViewer } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  const customerAuth = await requireMobileCustomer(request);
  if (customerAuth.ok) {
    try {
      const record = await getAiServiceRecordForRequestViewer({
        requestId: id,
        viewer: { kind: "customer", userId: customerAuth.ctx.userId },
      });
      if (!record) {
        return jsonError("NOT_FOUND", "রেকর্ড পাওয়া যায়নি", 404);
      }
      return jsonOk({ record });
    } catch {
      return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
    }
  }

  const techAuth = await requireMobileAiTechnicianActor(request);
  if (!techAuth.ok) {
    return customerAuth.response;
  }

  try {
    const record = await getAiServiceRecordForRequestViewer({
      requestId: id,
      viewer: {
        kind: "technician",
        technicianProfileId: techAuth.ctx.technicianProfileId,
      },
    });
    if (!record) {
      return jsonError("NOT_FOUND", "রেকর্ড পাওয়া যায়নি", 404);
    }
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
  }
}
