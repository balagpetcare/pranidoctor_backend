import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-response";

import { classifyDoctorPanelAuth } from "./panel-classify";
import {
  resolveDoctorPanelActor,
  type DoctorPanelActor,
} from "./panel-access";
import { AUTH_CHANNELS } from "../../../../modules/auth/identity-core.js";
import {
  assertJwtSessionActive,
} from "../../../../modules/auth/session-guard.helper.js";
import { getDoctorSession } from "./session";

export type { DoctorPanelActor } from "./panel-classify";
export { resolveDoctorPanelActor } from "./panel-access";

export async function requireDoctorPanelApiAccess(): Promise<
  NextResponse | null
> {
  const r = await requireDoctorApiActor();
  if (!r.ok) return r.response;
  return null;
}

export type RequireDoctorApiActorResult =
  | { ok: true; actor: DoctorPanelActor }
  | { ok: false; response: NextResponse };

/**
 * Resolves the current doctor once for route handlers (single DB round-trip when ok).
 */
export async function requireDoctorApiActor(): Promise<RequireDoctorApiActorResult> {
  const session = await getDoctorSession();
  if (session) {
    const guard = await assertJwtSessionActive(session, AUTH_CHANNELS.doctorPanel, {
      panel: true,
    });
    if (guard === "revoked") {
      return {
        ok: false,
        response: jsonError("UNAUTHORIZED", "Not signed in", 401),
      };
    }
  }
  const actor = session ? await resolveDoctorPanelActor(session) : null;
  const kind = classifyDoctorPanelAuth(session, actor);
  if (kind === "unauthenticated") {
    return {
      ok: false,
      response: jsonError("UNAUTHORIZED", "Not signed in", 401),
    };
  }
  if (kind === "forbidden") {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Doctor panel access required", 403),
    };
  }
  return { ok: true, actor: actor! };
}
