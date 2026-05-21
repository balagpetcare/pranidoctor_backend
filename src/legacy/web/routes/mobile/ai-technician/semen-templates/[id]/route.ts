import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { getSemenTemplateDetailForTechnician } from "@/lib/mobile-ai-technician/semen-template-catalog-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const row = await getSemenTemplateDetailForTechnician(id);
    if (!row) return jsonError("NOT_FOUND", "টেমপ্লেট পাওয়া যায়নি", 404);
    return jsonOk({ template: row });
  } catch {
    return jsonError("DATABASE_ERROR", "টেমপ্লেট লোড করা যায়নি", 500);
  }
}
