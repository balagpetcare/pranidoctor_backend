import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { patchSemenInventoryLotBodySchema } from "@/lib/mobile-ai-technician/semen-mobile-schemas";
import { patchSemenInventoryLot } from "@/lib/mobile-ai-technician/semen-inventory-service";

type Ctx = { params: Promise<{ id: string; lotId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id, lotId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = patchSemenInventoryLotBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  try {
    const result = await patchSemenInventoryLot(auth.ctx.userId, id, lotId, parsed.data);
    if (result.ok === "NO_PROFILE") {
      return jsonError("NO_PROFILE", "প্রোফাইল নেই", 422);
    }
    if (result.ok === "NOT_ALLOWED") {
      return jsonError("NOT_ALLOWED", "অনুমোদন প্রয়োজন", 403, { profileStatus: result.status });
    }
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "লট বা সার্ভিস পাওয়া যায়নি", 404);
    }
    if (result.ok === "NOT_SEMEN_SERVICE") {
      return jsonError("NOT_SEMEN_SERVICE", "এটি টেমপ্লেট ভিত্তিক সিমেন সার্ভিস নয়", 422);
    }
    if (result.ok === "INVALID_STOCK") {
      return jsonError("INVALID_STOCK", "স্টক পরিমাণ সঠিক নয়", 422);
    }
    return jsonOk({ lot: result.lot });
  } catch {
    return jsonError("DATABASE_ERROR", "আপডেট করা যায়নি", 500);
  }
}
