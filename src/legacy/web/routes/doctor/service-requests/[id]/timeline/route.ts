import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";

import { handleDoctorTimelineGet } from "../../../../../../../modules/timeline/compat/timeline-route.handler.js";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  return handleDoctorTimelineGet(auth.actor.doctorProfileId, id);
}
