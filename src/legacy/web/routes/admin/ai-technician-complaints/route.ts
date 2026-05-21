import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { adminListAiTechnicianComplaints } from "@/lib/mobile-ai-services/ai-quality-service";
import { adminListAiTechnicianComplaintsQuerySchema } from "@/lib/mobile-ai-services/ai-quality-schemas";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = adminListAiTechnicianComplaintsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  const limit = parsed.data.limit ?? 30;
  const offset = parsed.data.offset ?? 0;

  try {
    const data = await adminListAiTechnicianComplaints({
      status: parsed.data.status,
      limit,
      offset,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load complaints", 500);
  }
}
