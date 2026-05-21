import type { TechnicianJwtPayload } from "./jwt.js";

export type TechnicianPanelActor = {
  userId: string;
  aiTechnicianProfileId: string;
  email: string;
  displayName: string | null;
};

export type TechnicianPanelAuthKind = "ok" | "unauthenticated" | "forbidden";

export function classifyTechnicianPanelAuth(
  session: TechnicianJwtPayload | null,
  actor: TechnicianPanelActor | null,
): TechnicianPanelAuthKind {
  if (!session) return "unauthenticated";
  if (!actor) return "forbidden";
  return "ok";
}
