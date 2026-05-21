import {
  getAdminBillingSettings,
  updateAdminBillingSettings,
} from "@/lib/admin-billing/admin-billing-settings-service";
import {
  adminBillingSettingsPutSchema,
} from "@/lib/admin-billing/schemas";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const data = await getAdminBillingSettings();
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load billing settings", 500);
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

  const parsed = adminBillingSettingsPutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid body",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await updateAdminBillingSettings(parsed.data.commissionPercent);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not save billing settings", 500);
  }
}
