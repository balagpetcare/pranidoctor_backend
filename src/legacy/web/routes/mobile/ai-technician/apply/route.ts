import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import {
  serializeTechnicianProfile,
  upsertDraftApplication,
} from "@/lib/mobile-ai-technician/application-service";
import { applyAiTechnicianBodySchema } from "@/lib/mobile-ai-technician/schemas";

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = applyAiTechnicianBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await upsertDraftApplication(auth.ctx.userId, parsed.data);
    if (result.ok === "NOT_EDITABLE") {
      return jsonError(
        "NOT_EDITABLE",
        "এই অবস্থায় আবেদন সম্পাদনা করা যাবে না। অ্যাডমিন অনুমোদন বা সংশোধন নোট দেখুন।",
        409,
        { status: result.status },
      );
    }
    if (result.ok === "INVALID_EMAIL") {
      return jsonError(
        "EMAIL_IN_USE",
        "এই ইমেইলটি অন্য অ্যাকাউন্টে ব্যবহৃত হয়েছে",
        409,
      );
    }
    if (result.ok === "INVALID_LOCATION") {
      return jsonError(
        "INVALID_LOCATION",
        "নির্বাচিত জেলা / উপজেলা / ইউনিয়ন সঠিক নয় বা নিষ্ক্রিয়",
        422,
      );
    }
    return jsonOk({ profile: serializeTechnicianProfile(result.profile) });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
