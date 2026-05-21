import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { deleteDocument } from "@/lib/mobile-ai-technician/application-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await deleteDocument(auth.ctx.userId, id);
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "নথি খুঁজে পাওয়া যায়নি", 404);
    }
    if (result.ok === "NOT_EDITABLE") {
      return jsonError(
        "NOT_EDITABLE",
        "এই অবস্থায় নথি মুছতে পারবেন না।",
        409,
        { status: result.status },
      );
    }
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "মুছে ফেলা যায়নি", 500);
  }
}
