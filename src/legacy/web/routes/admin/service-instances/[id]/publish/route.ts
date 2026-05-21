import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  adminPatchServiceInstancePublish,
  patchServiceInstancePublishSchema,
} from "@/lib/service-instances/admin-service-instance-service";
import { getClientRequestMeta } from "@/lib/service-instances/request-meta";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const branch = url.searchParams.get("deploymentBranch") ?? undefined;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "JSON প্রয়োজন", 400);
  }
  const parsed = patchServiceInstancePublishSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  const meta = getClientRequestMeta(request);
  const result = await adminPatchServiceInstancePublish(
    auth.actor,
    id,
    parsed.data,
    meta,
    branch,
  );
  if (result.ok === "FORBIDDEN" || result.ok === "FORBIDDEN_ROLE") {
    return jsonError("FORBIDDEN", "প্রকাশের অনুমতি নেই", 403);
  }
  if (result.ok === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "খুঁজে পাওয়া যায়নি", 404);
  }
  if (result.ok === "TEMPLATE_NOT_APPROVED") {
    return jsonError("TEMPLATE_NOT_APPROVED", "টেমপ্লেট অনুমোদিত নয়", 409);
  }
  if (result.ok === "VALIDATION") {
    return jsonError("VALIDATION_ERROR", "যাচাইকরণ ব্যর্থ", 422, { issues: result.issues });
  }
  if (result.ok === "INVALID_STATE") {
    return jsonError("INVALID_STATE", result.message ?? "অবস্থা সঠিক নয়", 409);
  }
  if (result.ok === "DUPLICATE_LISTING") {
    return jsonError("DUPLICATE_LISTING", "লিস্টিং দ্বন্দ্ব", 409);
  }
  return jsonOk({ instance: result.instance });
}
