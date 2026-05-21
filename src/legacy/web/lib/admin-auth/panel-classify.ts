import type { UserRole } from "@/generated/prisma/client";

import type { AdminJwtPayload } from "./jwt";

export type AdminPanelActor = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
};

export type AdminPanelAuthKind = "ok" | "unauthenticated" | "forbidden";

/**
 * Maps cookie session + DB resolution to HTTP semantics for admin APIs:
 * - no session → 401
 * - session present but user is not an active panel admin in DB → 403
 */
export function classifyAdminPanelAuth(
  session: AdminJwtPayload | null,
  actor: AdminPanelActor | null,
): AdminPanelAuthKind {
  if (!session) return "unauthenticated";
  if (!actor) return "forbidden";
  return "ok";
}
