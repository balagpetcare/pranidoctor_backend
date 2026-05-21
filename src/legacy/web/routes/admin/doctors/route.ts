import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminCreateDoctor,
  adminListDoctors,
} from "@/lib/admin-doctors/doctor-admin-service";
import { doctorMutationErrorResponse } from "@/lib/admin-doctors/mutation-errors";
import {
  createDoctorBodySchema,
  listDoctorsQuerySchema,
} from "@/lib/admin-doctors/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listDoctorsQuerySchema.safeParse({
    q: url.searchParams.get("q")?.trim() || undefined,
    providerStatus: url.searchParams.get("providerStatus") ?? undefined,
    userStatus: url.searchParams.get("userStatus") ?? undefined,
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
    const data = await adminListDoctors(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load doctors", 500);
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

  const parsed = createDoctorBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid doctor payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const doctor = await adminCreateDoctor(parsed.data);
    return jsonOk({ doctor }, { status: 201 });
  } catch (e) {
    const mapped = doctorMutationErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
