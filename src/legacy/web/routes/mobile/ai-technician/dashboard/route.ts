import { jsonError, jsonOk } from "@/lib/api-response";
import { getMobileTechnicianDashboard } from "@/lib/mobile-ai-technician/dashboard-service";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  try {
    const dashboard = await getMobileTechnicianDashboard(auth.ctx.userId);
    return jsonOk(dashboard);
  } catch {
    return jsonError("DATABASE_ERROR", "ড্যাশবোর্ড লোড করা যায়নি", 500);
  }
}
