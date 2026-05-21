import { jsonError, jsonOk } from "@/lib/api-response";
import { getTechnicianAiServiceRequestById } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const row = await getTechnicianAiServiceRequestById({
      technicianProfileId: auth.ctx.technicianProfileId,
      id,
    });
    if (!row) {
      return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
    }
    return jsonOk({ request: row });
  } catch {
    return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
  }
}
