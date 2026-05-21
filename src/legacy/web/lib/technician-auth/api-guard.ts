import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-response";

import { classifyTechnicianPanelAuth } from "./panel-classify";
import {
  resolveTechnicianPanelActor,
  type TechnicianPanelActor,
} from "./panel-access";
import { AUTH_CHANNELS } from "../../../../modules/auth/identity-core.js";
import { assertJwtSessionActive } from "../../../../modules/auth/session-guard.helper.js";
import { getTechnicianSession } from "./session";

export type { TechnicianPanelActor } from "./panel-classify";
export { resolveTechnicianPanelActor } from "./panel-access";

export type RequireTechnicianApiActorResult =
  | { ok: true; actor: TechnicianPanelActor }
  | { ok: false; response: NextResponse };

export async function requireTechnicianApiActor(): Promise<RequireTechnicianApiActorResult> {
  const session = await getTechnicianSession();
  if (session) {
    const guard = await assertJwtSessionActive(session, AUTH_CHANNELS.technicianPanel, {
      panel: true,
    });
    if (guard === "revoked") {
      return {
        ok: false,
        response: jsonError("UNAUTHORIZED", "Not signed in", 401),
      };
    }
  }
  const actor = session ? await resolveTechnicianPanelActor(session) : null;
  const kind = classifyTechnicianPanelAuth(session, actor);
  if (kind === "unauthenticated") {
    return {
      ok: false,
      response: jsonError("UNAUTHORIZED", "Not signed in", 401),
    };
  }
  if (kind === "forbidden") {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Technician panel access required", 403),
    };
  }
  return { ok: true, actor: actor! };
}
