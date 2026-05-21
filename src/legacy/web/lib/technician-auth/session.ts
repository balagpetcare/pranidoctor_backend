import { cookies } from "next/headers";

import { TECHNICIAN_SESSION_COOKIE } from "./constants";
import { verifyTechnicianToken, type TechnicianJwtPayload } from "./jwt";

export async function getTechnicianSession(): Promise<TechnicianJwtPayload | null> {
  const jar = await cookies();
  const token = jar.get(TECHNICIAN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyTechnicianToken(token);
}
