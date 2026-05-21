import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import {
  createSemenInventoryLot,
  listSemenInventoryLots,
} from "@/lib/mobile-ai-technician/semen-inventory-service";
import { createSemenInventoryLotBodySchema } from "@/lib/mobile-ai-technician/semen-mobile-schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const result = await listSemenInventoryLots(auth.ctx.userId, id);
    if (result.ok === "NO_PROFILE") {
      return jsonError("NO_PROFILE", "প্রোফাইল নেই", 422);
    }
    if (result.ok === "NOT_ALLOWED") {
      return jsonError("NOT_ALLOWED", "অনুমোদন প্রয়োজন", 403, { profileStatus: result.status });
    }
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "সার্ভিস পাওয়া যায়নি", 404);
    }
    if (result.ok === "NOT_SEMEN_SERVICE") {
      return jsonError("NOT_SEMEN_SERVICE", "এটি টেমপ্লেট ভিত্তিক সিমেন সার্ভিস নয়", 422);
    }
    return jsonOk({ lots: result.lots });
  } catch {
    return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
  }
}

export async function POST(request: Request, context: Ctx) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = createSemenInventoryLotBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  try {
    const result = await createSemenInventoryLot(auth.ctx.userId, id, parsed.data);
    if (result.ok === "NO_PROFILE") {
      return jsonError("NO_PROFILE", "প্রোফাইল নেই", 422);
    }
    if (result.ok === "NOT_ALLOWED") {
      return jsonError("NOT_ALLOWED", "অনুমোদন প্রয়োজন", 403, { profileStatus: result.status });
    }
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "সার্ভিস পাওয়া যায়নি", 404);
    }
    if (result.ok === "NOT_SEMEN_SERVICE") {
      return jsonError("NOT_SEMEN_SERVICE", "এটি টেমপ্লেট ভিত্তিক সিমেন সার্ভিস নয়", 422);
    }
    if (result.ok === "INVALID_STOCK") {
      return jsonError("INVALID_STOCK", "স্টক পরিমাণ সঠিক নয়", 422);
    }
    return jsonOk({ lot: result.lot }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "সংরক্ষণ করা যায়নি", 500);
  }
}
