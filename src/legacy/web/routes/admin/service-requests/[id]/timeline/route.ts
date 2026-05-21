import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";

import { handleAdminTimelineGet } from "../../../../../../../modules/timeline/compat/timeline-route.handler.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;
  return handleAdminTimelineGet(id);
}
