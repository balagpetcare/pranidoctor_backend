import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "./constants";
import { verifyAdminToken, type AdminJwtPayload } from "./jwt";

export async function getAdminSession(): Promise<AdminJwtPayload | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
