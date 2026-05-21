import { jsonError, jsonOk } from "@/lib/api-response";
import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import { getDoctorEarningsSummary } from "@/lib/doctor-service-requests/doctor-earnings-service";

export async function GET() {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  try {
    const summary = await getDoctorEarningsSummary(auth.actor.doctorProfileId);
    return jsonOk(summary);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load earnings summary", 500);
  }
}
