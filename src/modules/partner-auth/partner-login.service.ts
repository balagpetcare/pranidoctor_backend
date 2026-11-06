import bcrypt from 'bcryptjs';

import { UserRole, UserStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { normalizeBdMobilePhone } from '../auth/phone.js';

export const PARTNER_LOGIN_MSG = {
  wrong: 'ইমেইল/ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়।',
} as const;

/** Roles that may sign in to the partner app (approved partners are promoted from CUSTOMER by admin). */
const PARTNER_LOGIN_ROLES: UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.DOCTOR,
  UserRole.AI_TECHNICIAN,
  UserRole.HEALTH_WORKER,
];

export type PartnerLoginResult =
  | { ok: true; userId: string; role: UserRole }
  | { ok: false; httpStatus: number; code: string; message: string };

const FAIL: PartnerLoginResult = {
  ok: false,
  httpStatus: 401,
  code: 'INVALID_CREDENTIALS',
  message: PARTNER_LOGIN_MSG.wrong,
};

/** Email or Bangladeshi mobile number + password. Same message for every failure (no enumeration). */
export async function loginPartnerWithPassword(params: {
  identifier: string;
  password: string;
}): Promise<PartnerLoginResult> {
  const id = params.identifier.trim();
  if (!id || params.password.length < 1) return FAIL;

  const prisma = getPrisma();
  let user;
  if (id.includes('@')) {
    user = await prisma.user.findFirst({ where: { email: id.toLowerCase() } });
  } else {
    const phone = normalizeBdMobilePhone(id);
    if (!phone) return FAIL;
    user = await prisma.user.findFirst({ where: { phone } });
  }

  if (!user || user.status !== UserStatus.ACTIVE || !PARTNER_LOGIN_ROLES.includes(user.role)) {
    return FAIL;
  }
  if (!(await bcrypt.compare(params.password, user.passwordHash))) return FAIL;
  return { ok: true, userId: user.id, role: user.role };
}
