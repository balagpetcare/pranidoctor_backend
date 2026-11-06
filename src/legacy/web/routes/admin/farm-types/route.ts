import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminCreateFarmType,
  adminListFarmTypes,
} from "@/lib/admin-farm-setup/farm-type-service";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createFarmTypeConfigBodySchema } from "@/lib/mobile-farms/schemas";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const types = await adminListFarmTypes();
    return jsonOk({ types });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load farm types", 500);
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

  const parsed = createFarmTypeConfigBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const type = await adminCreateFarmType(parsed.data);
    return jsonOk({ type }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "CODE_TAKEN") {
      return jsonError("CONFLICT", "This code is already in use", 409);
    }
    if (e instanceof Error && e.message === "PARENT_NOT_FOUND") {
      return jsonError("VALIDATION_ERROR", "Parent type not found", 422);
    }
    return jsonError("DATABASE_ERROR", "Could not create farm type", 500);
  }
}
