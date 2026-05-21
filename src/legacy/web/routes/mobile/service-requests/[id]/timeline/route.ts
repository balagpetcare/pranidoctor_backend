import { requireMobileCustomer } from "@/lib/mobile-auth/guard";

import { handleMobileTimelineGet } from "../../../../../../../modules/timeline/compat/timeline-route.handler.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  return handleMobileTimelineGet(auth.ctx.customerProfileId, id);
}
