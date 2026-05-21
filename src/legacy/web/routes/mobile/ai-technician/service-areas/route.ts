import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { addDivisionServiceArea } from "@/lib/mobile-ai-technician/application-service";
import { createDivisionServiceAreaBodySchema } from "@/lib/mobile-ai-technician/schemas";

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = createDivisionServiceAreaBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "এলাকার তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await addDivisionServiceArea(auth.ctx.userId, parsed.data);
    if (result.ok === "NO_PROFILE") {
      return jsonError(
        "NO_PROFILE",
        "প্রথমে আবেদনের খসড়া তৈরি করুন।",
        422,
      );
    }
    if (result.ok === "NOT_EDITABLE") {
      return jsonError(
        "NOT_EDITABLE",
        "এই অবস্থায় এলাকা যোগ করা যাবে না।",
        409,
        { status: result.status },
      );
    }
    if (result.ok === "INVALID_LOCATION") {
      return jsonError(
        "INVALID_LOCATION",
        "নির্বাচিত জেলা / উপজেলা / ইউনিয়ন সঠিক নয় বা নিষ্ক্রিয়",
        422,
      );
    }
    return jsonOk({ areaId: result.areaId }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "এলাকা সংরক্ষণ করা যায়নি", 500);
  }
}
