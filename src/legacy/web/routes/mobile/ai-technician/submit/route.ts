import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import {
  serializeTechnicianProfile,
  submitApplication,
} from "@/lib/mobile-ai-technician/application-service";

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await submitApplication(auth.ctx.userId);
    if (result.ok === "NO_PROFILE") {
      return jsonError(
        "NO_PROFILE",
        "প্রথমে আবেদনের খসড়া তৈরি করুন (প্রয়োগ করুন)।",
        422,
      );
    }
    if (result.ok === "NOT_EDITABLE") {
      return jsonError(
        "NOT_EDITABLE",
        "এই অবস্থায় জমা দেওয়া যাবে না।",
        409,
        { status: result.status },
      );
    }
    if (result.ok === "VALIDATION") {
      return jsonError(result.code, result.message, 422);
    }
    return jsonOk(
      {
        profile: serializeTechnicianProfile(result.profile),
        message: "আবেদন জমা দেওয়া হয়েছে। অ্যাডমিন পর্যালোচনার অপেক্ষায়।",
      },
      { status: 200 },
    );
  } catch {
    return jsonError("DATABASE_ERROR", "জমা দিতে ব্যর্থ হয়েছে", 500);
  }
}
