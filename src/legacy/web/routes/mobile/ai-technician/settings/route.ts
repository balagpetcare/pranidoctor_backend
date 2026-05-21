import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { patchAiTechnicianSettingsBodySchema } from "@/lib/mobile-ai-technician/technician-services-schemas";
import { patchTechnicianSettingsForMobileUser } from "@/lib/mobile-ai-technician/technician-services-service";

/**
 * Published technicians can toggle `acceptsEmergency` (urgent-call availability signal).
 */
export async function PATCH(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = patchAiTechnicianSettingsBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await patchTechnicianSettingsForMobileUser(
      auth.ctx.userId,
      parsed.data.acceptsEmergency,
    );
    if (result.ok === "NO_PROFILE") {
      return jsonError(
        "NO_PROFILE",
        "আপনি এখনও এআই টেকনিশিয়ান প্রোফাইল শুরু করেননি",
        422,
      );
    }
    if (result.ok === "NOT_PUBLISHED") {
      return jsonError(
        "NOT_PUBLISHED",
        "প্রকাশিত প্রোফাইলের পরেই এই সেটিং পরিবর্তন করা যাবে",
        403,
      );
    }
    return jsonOk({ ok: true });
  } catch {
    return jsonError("DATABASE_ERROR", "সেটিং সংরক্ষণ করা যায়নি", 500);
  }
}
