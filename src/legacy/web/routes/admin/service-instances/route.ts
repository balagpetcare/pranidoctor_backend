import { requireAdminApiActor } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  adminListServiceInstances,
  listServiceInstancesQuerySchema,
} from "@/lib/service-instances/admin-service-instance-service";

export async function GET(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const raw = {
    status: url.searchParams.get("status") ?? undefined,
    statuses: url.searchParams.get("statuses") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    deploymentBranch: url.searchParams.get("deploymentBranch") ?? undefined,
    tenantId: url.searchParams.get("tenantId") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };
  const parsed = listServiceInstancesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "কোয়েরি সঠিক নয়", 422, parsed.error.flatten());
  }

  const result = await adminListServiceInstances(auth.actor, parsed.data);
  if (result.ok === "FORBIDDEN") {
    return jsonError("FORBIDDEN", "অনুমতি নেই", 403);
  }
  return jsonOk(result);
}
