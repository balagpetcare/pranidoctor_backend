import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DOCTOR_SESSION_COOKIE } from "./constants";
import { resolveDoctorPanelActor } from "./panel-access";
import { getDoctorSession } from "./session";

/**
 * Server-side gate for the doctor dashboard route group. Complements Edge middleware
 * with a Prisma-backed check so revoked or suspended users cannot render the shell.
 */
export async function ensureDoctorDashboardAccess(): Promise<void> {
  const session = await getDoctorSession();
  if (!session) {
    redirect("/doctor/login");
  }

  const actor = await resolveDoctorPanelActor(session);
  if (!actor) {
    const jar = await cookies();
    jar.delete(DOCTOR_SESSION_COOKIE);
    redirect("/doctor/login");
  }
}
