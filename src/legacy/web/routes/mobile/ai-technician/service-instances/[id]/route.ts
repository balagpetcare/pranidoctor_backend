import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";
import {
  mobileGetServiceInstanceDetail,
  mobilePatchServiceInstance,
  patchServiceInstanceBodySchema,
} from "@/lib/service-instances/mobile-service-instance-service";
import { getClientRequestMeta } from "@/lib/service-instances/request-meta";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteCtx) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const result = await mobileGetServiceInstanceDetail(
    auth.ctx.userId,
    auth.ctx.technicianProfileId,
    id,
  );
  if (result.ok === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "খুঁজে পাওয়া যায়নি", 404);
  }
  return jsonOk({
    instance: result.instance,
    schema: result.schema,
    mergedValues: result.mergedValues,
    media: result.media,
  });
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "JSON প্রয়োজন", 400);
  }
  const parsed = patchServiceInstanceBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  const meta = getClientRequestMeta(request);
  const result = await mobilePatchServiceInstance(
    auth.ctx.userId,
    auth.ctx.technicianProfileId,
    id,
    parsed.data,
    meta,
  );
  if (result.ok === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "খুঁজে পাওয়া যায়নি", 404);
  }
  if (result.ok === "NOT_EDITABLE") {
    return jsonError("NOT_EDITABLE", "সম্পাদনা করা যাবে না", 409, {
      status: result.status,
    });
  }
  if (result.ok === "VERSION_CONFLICT") {
    return jsonError("VERSION_CONFLICT", "সংস্করণ দ্বন্দ্ব", 409);
  }
  if (result.ok === "INVALID_MEDIA") {
    return jsonError("INVALID_MEDIA", result.message, 422);
  }
  return jsonOk({ instance: result.instance });
}
