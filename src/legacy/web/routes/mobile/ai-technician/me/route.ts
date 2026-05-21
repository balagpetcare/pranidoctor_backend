import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { getTechnicianProfileForUser, serializeTechnicianProfile } from "@/lib/mobile-ai-technician/application-service";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  try {
    const profile = await getTechnicianProfileForUser(auth.ctx.userId);
    if (!profile) {
      return jsonOk({
        profile: null,
        message: "আপনি এখনও এআই টেকনিশিয়ান আবেদন শুরু করেননি",
      });
    }
    return jsonOk({ profile: serializeTechnicianProfile(profile) });
  } catch {
    return jsonError("DATABASE_ERROR", "প্রোফাইল লোড করা যায়নি", 500);
  }
}
