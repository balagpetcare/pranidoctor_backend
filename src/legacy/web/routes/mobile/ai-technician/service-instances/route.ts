import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";
import {
  createServiceInstanceBodySchema,
  listMyServiceInstancesQuerySchema,
  mobileCreateServiceInstance,
  mobileListServiceInstances,
} from "@/lib/service-instances/mobile-service-instance-service";
import { getClientRequestMeta } from "@/lib/service-instances/request-meta";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const raw = {
    status: url.searchParams.get("status") ?? undefined,
    deploymentBranch: url.searchParams.get("deploymentBranch") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };
  const parsed = listMyServiceInstancesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "কোয়েরি সঠিক নয়", 422, parsed.error.flatten());
  }

  const result = await mobileListServiceInstances(
    auth.ctx.userId,
    auth.ctx.technicianProfileId,
    parsed.data,
  );
  return jsonOk(result);
}

export async function POST(request: Request) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "JSON প্রয়োজন", 400);
  }
  const parsed = createServiceInstanceBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  const meta = getClientRequestMeta(request);
  const result = await mobileCreateServiceInstance(
    auth.ctx.userId,
    auth.ctx.technicianProfileId,
    parsed.data,
    meta,
  );
  if (result.ok === "TEMPLATE_NOT_FOUND") {
    return jsonError("TEMPLATE_NOT_FOUND", "টেমপ্লেট পাওয়া যায়নি", 404);
  }
  return jsonOk({ id: result.id }, { status: 201 });
}
