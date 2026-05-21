import { jsonError, jsonOk } from "@/lib/api-response";
import { listTechnicianAiServiceRequests } from "@/lib/mobile-ai-technician/technician-ai-requests-service";
import { listTechnicianAiRequestsQuerySchema } from "@/lib/mobile-ai-technician/technician-ai-requests-schemas";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = listTechnicianAiRequestsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await listTechnicianAiServiceRequests({
      technicianProfileId: auth.ctx.technicianProfileId,
      query: parsed.data,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "তালিকা লোড করা যায়নি", 500);
  }
}
