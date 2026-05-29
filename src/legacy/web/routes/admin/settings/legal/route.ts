import {
  getAdminLegalSettings,
  updateAdminLegalSettings,
} from "@/lib/admin-legal/admin-legal-settings-service";
import { adminLegalSettingsPutSchema } from "@/lib/admin-legal/schemas";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const data = await getAdminLegalSettings();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load legal settings", 500);
  }
}

export async function PUT(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "JSON body required", 400);
  }

  const parsed = adminLegalSettingsPutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid body", 422, parsed.error.flatten());
  }

  try {
    const data = await updateAdminLegalSettings(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not save legal settings", 500);
  }
}
