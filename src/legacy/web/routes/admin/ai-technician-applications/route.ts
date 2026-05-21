import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminListTechnicianApplications,
} from "@/lib/admin-ai-technician-applications/application-review-service";
import {
  listTechnicianApplicationsQuerySchema,
} from "@/lib/admin-ai-technician-applications/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listTechnicianApplicationsQuerySchema.safeParse({
    applicationStatus: url.searchParams.get("applicationStatus") ?? undefined,
    q: url.searchParams.get("q")?.trim() || undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await adminListTechnicianApplications(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "আবেদন তালিকা লোড করা যায়নি", 500);
  }
}
