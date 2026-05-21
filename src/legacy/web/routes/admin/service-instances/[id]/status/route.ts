import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  adminPatchServiceInstanceStatus,
  patchServiceInstanceStatusSchema,
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
  const parsed = patchServiceInstanceStatusSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  const meta = getClientRequestMeta(request);
  const result = await adminPatchServiceInstanceStatus(
    auth.actor,
    id,
    parsed.data,
    meta,
    branch,
  );
  if (result.ok === "FORBIDDEN") {
    return jsonError("FORBIDDEN", "অনুমতি নেই", 403);
  }
  if (result.ok === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "খুঁজে পাওয়া যায়নি", 404);
  }
  if (result.ok === "INVALID_TRANSITION") {
    return jsonError(
      "INVALID_TRANSITION",
      result.message,
      409,
      result.code ? { code: result.code } : undefined,
    );
  }
  return jsonOk({ instance: result.instance });
}
