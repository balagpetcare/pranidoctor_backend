import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { createAiServiceRequestForCustomer } from "@/lib/mobile-ai-services/ai-services-service";
import { createAiServiceRequestBodySchema } from "@/lib/mobile-ai-services/schemas";

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = createAiServiceRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createAiServiceRequestForCustomer(
      auth.ctx.userId,
      parsed.data,
    );
    if (result.ok === "NOT_FOUND_SERVICE") {
      return jsonError("NOT_FOUND", "সার্ভিস পাওয়া যায়নি", 404);
    }
    if (result.ok === "NOT_FOUND_TECHNICIAN") {
      return jsonError("NOT_FOUND", "টেকনিশিয়ান পাওয়া যায়নি", 404);
    }
    if (result.ok === "SERVICE_TECH_MISMATCH") {
      return jsonError(
        "VALIDATION_ERROR",
        "সার্ভিস ও টেকনিশিয়ান মিলছে না",
        422,
      );
    }
    if (result.ok === "ANIMAL_TYPE_MISMATCH") {
      return jsonError(
        "VALIDATION_ERROR",
        "প্রাণীর ধরন সার্ভিসের সাথে মিলছে না",
        422,
      );
    }
    if (result.ok === "AREA_MISMATCH") {
      return jsonError(
        "AREA_MISMATCH",
        "নির্বাচিত টেকনিশিয়ান এই এলাকায় সেবা দেন না",
        422,
      );
    }
    return jsonOk({ request: result.request }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "অনুরোধ সংরক্ষণ করা যায়নি", 500);
  }
}
