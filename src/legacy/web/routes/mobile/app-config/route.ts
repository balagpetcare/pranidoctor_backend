/**
 * Read-only mobile bootstrap: optional public-ish values (no secrets).
 * Anonymous-friendly — home/discovery must work before OTP login.
 *
 * - `MOBILE_EMERGENCY_PHONE` — E.164 or local digits for tel: links.
 * - Optional merge from `Setting` key `mobile.app.config` (seeded in dev demo).
 */
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const raw = process.env.MOBILE_EMERGENCY_PHONE?.trim() ?? "";
    let emergencyPhone = raw.length > 0 ? raw : null;

    let supportPhone: string | null = null;
    let supportWhatsapp: string | null = null;

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
      }
    } catch {
      /* ignore optional Setting read */
    }

    if (!emergencyPhone && supportPhone) {
      emergencyPhone = supportPhone;
    }

    return jsonOk({
      emergencyPhone,
      supportPhone,
      supportWhatsapp,
    });
  } catch {
    return jsonError("INTERNAL", "Could not read app config", 500);
  }
}
