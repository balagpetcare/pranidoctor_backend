import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-response";

import { classifyAdminPanelAuth } from "./panel-classify";
import {
  resolveAdminPanelActor,
  type AdminPanelActor,
} from "./panel-access";
import { getAdminSession } from "./session";

export type { AdminPanelActor } from "./panel-classify";
export { resolveAdminPanelActor } from "./panel-access";

export async function requireAdminPanelApiAccess(): Promise<
  NextResponse | null
> {
  const session = await getAdminSession();
  const actor = session ? await resolveAdminPanelActor(session) : null;
  const kind = classifyAdminPanelAuth(session, actor);
  if (kind === "unauthenticated") {
    return jsonError("UNAUTHORIZED", "Not signed in", 401);
  }
  if (kind === "forbidden") {
    return jsonError("FORBIDDEN", "Admin panel access required", 403);
  }
  return null;
}

export type RequireAdminApiActorResult =
  | { ok: true; actor: AdminPanelActor }
  | { ok: false; response: NextResponse };

/**
 * Resolves the current admin user once for route handlers (single DB round-trip when ok).
 */
export async function requireAdminApiActor(): Promise<RequireAdminApiActorResult> {
  const session = await getAdminSession();
  const actor = session ? await resolveAdminPanelActor(session) : null;
  const kind = classifyAdminPanelAuth(session, actor);
  if (kind === "unauthenticated") {
    return {
      ok: false,
      response: jsonError("UNAUTHORIZED", "Not signed in", 401),
    };
  }
  if (kind === "forbidden") {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Admin panel access required", 403),
    };
  }
  return { ok: true, actor: actor! };
}
