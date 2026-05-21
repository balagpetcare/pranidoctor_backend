import type { DoctorJwtPayload } from "./jwt.js";

export type DoctorPanelActor = {
  userId: string;
  doctorProfileId: string;
  email: string;
  displayName: string | null;
};

export type DoctorPanelAuthKind = "ok" | "unauthenticated" | "forbidden";

export function classifyDoctorPanelAuth(
  session: DoctorJwtPayload | null,
  actor: DoctorPanelActor | null,
): DoctorPanelAuthKind {
  if (!session) return "unauthenticated";
  if (!actor) return "forbidden";
  return "ok";
}
