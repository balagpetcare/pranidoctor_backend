import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "./constants";
import { resolveAdminPanelActor } from "./panel-access";
import { getAdminSession } from "./session";

/**
 * Server-side gate for the admin dashboard route group. Complements Edge middleware
 * (JWT-only) with a Prisma-backed check so revoked roles cannot render the shell.
 */
export async function ensureAdminDashboardAccess(): Promise<void> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const actor = await resolveAdminPanelActor(session);
  if (!actor) {
    const jar = await cookies();
    jar.delete(ADMIN_SESSION_COOKIE);
    redirect("/admin/login");
  }
}
