import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { createAiTechnicianReviewForCustomer } from "@/lib/mobile-ai-services/ai-quality-service";
import { postAiTechnicianReviewBodySchema } from "@/lib/mobile-ai-services/ai-quality-schemas";

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

  const parsed = postAiTechnicianReviewBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await createAiTechnicianReviewForCustomer({
      customerUserId: auth.ctx.userId,
      requestId: id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "সম্পন্ন অনুরোধ পাওয়া যায়নি", 404);
    }
    if (result.ok === "ALREADY_REVIEWED") {
      return jsonError("ALREADY_REVIEWED", "ইতিমধ্যে রিভিউ দেওয়া হয়েছে", 409);
    }
    return jsonOk({ review: result.review }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
