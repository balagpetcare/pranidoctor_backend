import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { adminGetServiceInstanceDetail } from "@/lib/service-instances/admin-service-instance-service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const branch = url.searchParams.get("deploymentBranch") ?? undefined;

  const result = await adminGetServiceInstanceDetail(auth.actor, id, branch);
  if (result.ok === "FORBIDDEN") {
    return jsonError("FORBIDDEN", "অনুমতি নেই", 403);
  }
  if (result.ok === "NOT_FOUND") {
    return jsonError("NOT_FOUND", "খুঁজে পাওয়া যায়নি", 404);
  }
  return jsonOk({
    instance: result.instance,
    schema: result.schema,
    mergedValues: result.mergedValues,
    mediaPreviews: result.mediaPreviews,
  });
}
