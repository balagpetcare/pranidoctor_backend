import { cookies } from "next/headers";

import { DOCTOR_SESSION_COOKIE } from "./constants";
import { verifyDoctorToken, type DoctorJwtPayload } from "./jwt";

export async function getDoctorSession(): Promise<DoctorJwtPayload | null> {
  const jar = await cookies();
  const token = jar.get(DOCTOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyDoctorToken(token);
}
