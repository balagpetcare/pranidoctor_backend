/**
 * Read-only mobile bootstrap: optional public-ish values (no secrets).
 * Anonymous-friendly — home/discovery must work before OTP login.
 *
 * - `MOBILE_EMERGENCY_PHONE` — E.164 or local digits for tel: links.
 * - Optional merge from `Setting` key `mobile.app.config` (seeded in dev demo).
 */
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export async function GET() {
  try {
    const raw = process.env.MOBILE_EMERGENCY_PHONE?.trim() ?? "";
    let emergencyPhone = raw.length > 0 ? raw : null;

    let supportPhone: string | null = null;
    let supportWhatsapp: string | null = null;
    let minimumVersion: string | null = null;
    let recommendedVersion: string | null = null;
    let updateUrl: string | null = null;
    let updateRequired: boolean | null = null;
    let updateMessage: string | null = null;
    let maintenanceMode: boolean | null = null;
    let maintenanceMessage: string | null = null;

    try {
      const row = await prisma.setting.findUnique({
        where: { key: "mobile.app.config" },
        select: { valueJson: true },
      });
      const j = row?.valueJson;
      if (j !== null && typeof j === "object" && !Array.isArray(j)) {
        const o = j as Record<string, unknown>;
        const sp = o.supportPhone;
        const sw = o.supportWhatsapp;
        if (typeof sp === "string" && sp.trim().length > 0) {
          supportPhone = sp.trim();
        }
        if (typeof sw === "string" && sw.trim().length > 0) {
          supportWhatsapp = sw.trim();
        }
        minimumVersion = readOptionalString(o.minimumVersion);
        recommendedVersion = readOptionalString(o.recommendedVersion);
        updateUrl = readOptionalString(o.updateUrl);
        updateRequired = readOptionalBoolean(o.updateRequired);
        updateMessage = readOptionalString(o.updateMessage);
        maintenanceMode = readOptionalBoolean(o.maintenanceMode);
        maintenanceMessage = readOptionalString(o.maintenanceMessage);
      }
    } catch {
      /* ignore optional Setting read */
    }

    let closedBeta: Record<string, unknown> | null = null;
    try {
      const betaRow = await prisma.setting.findUnique({
        where: { key: "launch.closedBeta.config" },
        select: { valueJson: true },
      });
      const b = betaRow?.valueJson;
      if (b !== null && typeof b === "object" && !Array.isArray(b)) {
        const bo = b as Record<string, unknown>;
        if (bo.enabled === true) {
          closedBeta = {
            enabled: true,
            feedbackEnabled: bo.feedbackEnabled !== false,
            activeCohort: typeof bo.activeCohort === "string" ? bo.activeCohort : "NONE",
            betaBanner:
              bo.betaBanner !== null &&
              typeof bo.betaBanner === "object" &&
              !Array.isArray(bo.betaBanner)
                ? bo.betaBanner
                : null,
            supportWhatsapp:
              typeof bo.userSupportWhatsapp === "string"
                ? bo.userSupportWhatsapp
                : supportWhatsapp,
          };
        }
      }
    } catch {
      /* optional */
    }

    if (!emergencyPhone && supportPhone) {
      emergencyPhone = supportPhone;
    }

    return jsonOk({
      emergencyPhone,
      supportPhone,
      supportWhatsapp,
      ...(minimumVersion ? { minimumVersion } : {}),
      ...(recommendedVersion ? { recommendedVersion } : {}),
      ...(updateUrl ? { updateUrl } : {}),
      ...(updateRequired !== null ? { updateRequired } : {}),
      ...(updateMessage ? { updateMessage } : {}),
      ...(maintenanceMode !== null ? { maintenanceMode } : {}),
      ...(maintenanceMessage ? { maintenanceMessage } : {}),
      ...(closedBeta ? { closedBeta } : {}),
    });
  } catch {
    return jsonError("INTERNAL", "Could not read app config", 500);
  }
}
