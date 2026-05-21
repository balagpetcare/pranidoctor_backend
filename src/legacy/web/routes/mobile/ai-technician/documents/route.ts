import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { addDocument } from "@/lib/mobile-ai-technician/application-service";
import { createAiTechnicianDocumentBodySchema } from "@/lib/mobile-ai-technician/schemas";

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = createAiTechnicianDocumentBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "নথির তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await addDocument(auth.ctx.userId, parsed.data);
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
        "এই অবস্থায় নথি যোগ করা যাবে না।",
        409,
        { status: result.status },
      );
    }
    if (result.ok === "UPLOAD_NOT_FOUND") {
      return jsonError(
        "UPLOAD_NOT_FOUND",
        "আপলোড করা ফাইল খুঁজে পাওয়া যায়নি বা ইতিমধ্যে ব্যবহৃত হয়েছে",
        404,
      );
    }
    if (result.ok === "UPLOAD_PURPOSE_MISMATCH") {
      return jsonError(
        "UPLOAD_PURPOSE_MISMATCH",
        "ফাইলের উদ্দেশ্য নথির ধরনের সাথে মিলছে না",
        422,
      );
    }
    return jsonOk({ documentId: result.documentId }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "নথি সংরক্ষণ করা যায়নি", 500);
  }
}
