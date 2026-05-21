import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import {
  adminApplyTechnicianApplicationTransition,
} from "@/lib/admin-ai-technician-applications/application-review-service";
import { applicationTransitionBodySchema } from "@/lib/admin-ai-technician-applications/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "অনুরোধ JSON হতে হবে", 400);
  }

  const parsed = applicationTransitionBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "কাজের তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await adminApplyTechnicianApplicationTransition(
      id,
      auth.actor.id,
      parsed.data,
    );
    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "আবেদন খুঁজে পাওয়া যায়নি", 404);
    }
    if (result.ok === "INVALID_TRANSITION") {
      return jsonError("INVALID_TRANSITION", result.message, 409);
    }
    return jsonOk({ technician: result.technician });
  } catch {
    return jsonError("DATABASE_ERROR", "অবস্থা পরিবর্তন করা যায়নি", 500);
  }
}
