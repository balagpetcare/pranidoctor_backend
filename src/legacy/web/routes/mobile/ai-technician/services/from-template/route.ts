import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { createTechnicianServiceFromTemplate } from "@/lib/mobile-ai-technician/semen-from-template-service";
import { createServiceFromTemplateBodySchema } from "@/lib/mobile-ai-technician/semen-mobile-schemas";
import { serializeAiTechnicianServiceForMobile } from "@/lib/mobile-ai-technician/technician-services-service";

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = createServiceFromTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  try {
    const result = await createTechnicianServiceFromTemplate(auth.ctx.userId, parsed.data);
    if (result.ok === "NO_PROFILE") {
      return jsonError("NO_PROFILE", "আপনি এখনও এআই টেকনিশিয়ান প্রোফাইল শুরু করেননি", 422);
    }
    if (result.ok === "NOT_ALLOWED") {
      return jsonError("NOT_ALLOWED", "অ্যাডমিন অনুমোদনের পরেই ব্যবহার করা যাবে", 403, {
        profileStatus: result.status,
      });
    }
    if (result.ok === "TEMPLATE_NOT_FOUND") {
      return jsonError("TEMPLATE_NOT_FOUND", "টেমপ্লেট পাওয়া যায়নি", 404);
    }
    if (result.ok === "OFFER_DISCOUNT_BOTH") {
      return jsonError("OFFER_DISCOUNT_BOTH", "অফার মূল্য ও ছাড় একসাথে দেওয়া যাবে না", 422);
    }
    if (result.ok === "DUPLICATE_TEMPLATE_SERVICE") {
      return jsonError(
        "DUPLICATE_TEMPLATE_SERVICE",
        "এই টেমপ্লেটে ইতিমধ্যে একটি সার্ভিস আছে",
        409,
      );
    }
    const service = await serializeAiTechnicianServiceForMobile(result.service);
    return jsonOk({ service }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "সার্ভিস তৈরি করা যায়নি", 500);
  }
}
