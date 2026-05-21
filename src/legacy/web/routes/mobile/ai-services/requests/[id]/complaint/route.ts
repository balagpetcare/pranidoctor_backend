import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { createAiTechnicianComplaintForCustomer } from "@/lib/mobile-ai-services/ai-quality-service";
import { postAiTechnicianComplaintBodySchema } from "@/lib/mobile-ai-services/ai-quality-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = postAiTechnicianComplaintBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createAiTechnicianComplaintForCustomer({
      customerUserId: auth.ctx.userId,
      requestId: id,
      category: parsed.data.category,
      message: parsed.data.message,
    });
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "অনুরোধ পাওয়া যায়নি", 404);
    }
    if (result.ok === "NO_TECHNICIAN") {
      return jsonError(
        "NO_TECHNICIAN",
        "এই অনুরোধে টেকনিশিয়ান নির্ধারিত নয়",
        422,
      );
    }
    return jsonOk({ complaint: result.complaint }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
