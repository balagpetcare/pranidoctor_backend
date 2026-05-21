import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminCreateTechnician,
  adminListTechnicians,
} from "@/lib/admin-ai-technicians/technician-admin-service";
import { technicianMutationErrorResponse } from "@/lib/admin-ai-technicians/mutation-errors";
import {
  createTechnicianBodySchema,
  listTechniciansQuerySchema,
} from "@/lib/admin-ai-technicians/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listTechniciansQuerySchema.safeParse({
    q: url.searchParams.get("q")?.trim() || undefined,
    providerStatus: url.searchParams.get("providerStatus") ?? undefined,
    userStatus: url.searchParams.get("userStatus") ?? undefined,
    areaId: url.searchParams.get("areaId")?.trim() || undefined,
    villageId: url.searchParams.get("villageId")?.trim() || undefined,
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
    const data = await adminListTechnicians(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load technicians", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createTechnicianBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid technician payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const technician = await adminCreateTechnician(parsed.data);
    return jsonOk({ technician }, { status: 201 });
  } catch (e) {
    const mapped = technicianMutationErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
