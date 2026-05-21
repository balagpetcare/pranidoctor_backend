import { jsonError, jsonOk } from "@/lib/api-response";
import { getAiServiceTechnicianPublic } from "@/lib/mobile-ai-services/ai-services-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await getAiServiceTechnicianPublic(id);
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "টেকনিশিয়ান পাওয়া যায়নি", 404);
    }
    return jsonOk({ technician: result.technician });
  } catch {
    return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
  }
}
