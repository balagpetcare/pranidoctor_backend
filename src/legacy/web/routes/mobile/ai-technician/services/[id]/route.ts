import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import {
  deactivateTechnicianServiceForMobileUser,
  patchTechnicianServiceForMobileUser,
} from "@/lib/mobile-ai-technician/technician-services-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  try {
    const result = await patchTechnicianServiceForMobileUser(auth.ctx.userId, id, json);
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
        "অ্যাডমিন অনুমোদনের পরেই সার্ভিস সম্পাদনা করা যাবে",
        403,
        { profileStatus: result.status },
      );
    }
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "সার্ভিস খুঁজে পাওয়া যায়নি", 404);
    }
    if (result.ok === "NOT_EDITABLE") {
      return jsonError(
        "NOT_EDITABLE",
        "এই অবস্থায় সার্ভিস সম্পাদনা করা যাবে না",
        409,
        { status: result.status },
      );
    }
    if (result.ok === "VALIDATION_ERROR") {
      return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, result.issues);
    }
    return jsonOk({ service: result.service });
  } catch {
    return jsonError("DATABASE_ERROR", "সার্ভিস আপডেট করা যায়নি", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await deactivateTechnicianServiceForMobileUser(
      auth.ctx.userId,
      id,
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
        "অ্যাডমিন অনুমোদনের পরেই সার্ভিস নিষ্ক্রিয় করা যাবে",
        403,
        { profileStatus: result.status },
      );
    }
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "সার্ভিস খুঁজে পাওয়া যায়নি", 404);
    }
    return jsonOk({ service: result.service });
  } catch {
    return jsonError("DATABASE_ERROR", "সার্ভিস নিষ্ক্রিয় করা যায়নি", 500);
  }
}
