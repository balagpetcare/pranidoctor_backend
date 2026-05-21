import type { AuthContext as PrismaAuthContext, User as PrismaUser } from '../../generated/prisma/index.js';
import { AuthContext as PrismaAuthContextEnum } from '../../generated/prisma/index.js';
import type { AuthContext as SecurityAuthContext, UserRole } from '../../shared/security/types.js';

import type { AuthUserRecord, PersistedSessionRecord } from './auth.repository.types.js';

const SECURITY_TO_PRISMA_CONTEXT: Record<SecurityAuthContext, PrismaAuthContext> = {
  mobile: PrismaAuthContextEnum.MOBILE,
  admin: PrismaAuthContextEnum.ADMIN,
  doctor: PrismaAuthContextEnum.DOCTOR,
  technician: PrismaAuthContextEnum.TECHNICIAN,
  api: PrismaAuthContextEnum.API,
};

const PRISMA_TO_SECURITY_CONTEXT: Record<PrismaAuthContext, SecurityAuthContext> = {
  MOBILE: 'mobile',
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  TECHNICIAN: 'technician',
  API: 'api',
};

export function toPrismaAuthContext(context: SecurityAuthContext): PrismaAuthContext {
  return SECURITY_TO_PRISMA_CONTEXT[context];
}

export function fromPrismaAuthContext(context: PrismaAuthContext): SecurityAuthContext {
  return PRISMA_TO_SECURITY_CONTEXT[context];
}

export function mapUserRecord(
  user: PrismaUser & { role: { name: string } }
): AuthUserRecord {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    displayName: user.displayName,
    role: user.role.name as UserRole,
    status: user.status,
    tenantId: user.tenantId,
    passwordHash: user.passwordHash,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function mapSessionRecord(session: {
  id: string;
  userId: string;
  context: PrismaAuthContext;
  status: string;
  deviceId: string | null;
  expiresAt: Date;
  lastActiveAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  tenantId: string | null;
  createdAt: Date;
}): PersistedSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    context: fromPrismaAuthContext(session.context),
    status: session.status as PersistedSessionRecord['status'],
    deviceId: session.deviceId,
    expiresAt: session.expiresAt,
    lastActiveAt: session.lastActiveAt,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason,
    tenantId: session.tenantId,
    createdAt: session.createdAt,
  };
}
