import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getNotificationSettingsForUser,
  upsertNotificationSettingsForUser,
} from "@/lib/notifications/notification-service";
import { z } from "zod";

const settingsBodySchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    marketingEnabled: z.boolean().optional(),
    treatmentReminderEnabled: z.boolean().optional(),
    vaccineReminderEnabled: z.boolean().optional(),
    orderServiceEnabled: z.boolean().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const settings = await getNotificationSettingsForUser(auth.ctx.userId);
    return jsonOk({ settings });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load notification settings", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = settingsBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid settings payload", 422, parsed.error.flatten());
  }

  try {
    const settings = await upsertNotificationSettingsForUser(auth.ctx.userId, parsed.data);
    return jsonOk({ settings });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not save notification settings", 500);
  }
}
