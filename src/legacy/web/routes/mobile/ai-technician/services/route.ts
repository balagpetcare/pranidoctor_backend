import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { createAiTechnicianServiceBodySchema } from "@/lib/mobile-ai-technician/technician-services-schemas";
import {
  createTechnicianServiceForMobileUser,
  listTechnicianServicesForMobileUser,
} from "@/lib/mobile-ai-technician/technician-services-service";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await listTechnicianServicesForMobileUser(auth.ctx.userId);
    return jsonOk({ services: result.services });
  } catch {
    return jsonError("DATABASE_ERROR", "সার্ভিস তালিকা লোড করা যায়নি", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = createAiTechnicianServiceBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createTechnicianServiceForMobileUser(
      auth.ctx.userId,
      parsed.data,
    );
    if (result.ok === "NO_PROFILE") {
      return jsonError(
        "NO_PROFILE",
        "আপনি এখনও এআই টেকনিশিয়ান প্রোফাইল শুরু করেননি",
        422,
      );
    }
    if (result.ok === "NOT_ALLOWED") {
      return jsonError(
        "NOT_ALLOWED",
        "অ্যাডমিন অনুমোদনের পরেই সার্ভিস তৈরি করা যাবে",
        403,
        { profileStatus: result.status },
      );
    }
    return jsonOk({ service: result.service });
  } catch {
    return jsonError("DATABASE_ERROR", "সার্ভিস সংরক্ষণ করা যায়নি", 500);
  }
}
