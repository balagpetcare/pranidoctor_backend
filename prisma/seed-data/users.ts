import { createHash } from 'crypto';

import type { PrismaClient } from '../../src/generated/prisma/index.js';

const DEV_ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@pranidoctor.local';
const DEV_ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'ChangeMe!Admin123';
const DEV_ADMIN_PHONE = process.env['SEED_ADMIN_PHONE'] ?? '+8801700000001';

function hashPassword(password: string): string {
  return createHash('sha256').update(`pd:${password}`).digest('hex');
}

export async function seedDevUsers(
  prisma: PrismaClient,
  roleIds: Map<string, string>
): Promise<void> {
  const adminRoleId = roleIds.get('ADMIN');
  const userRoleId = roleIds.get('USER');

  if (!adminRoleId || !userRoleId) {
    throw new Error('Required roles not seeded');
  }

  await prisma.user.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    create: {
      email: DEV_ADMIN_EMAIL,
      phone: DEV_ADMIN_PHONE,
      passwordHash: hashPassword(DEV_ADMIN_PASSWORD),
      displayName: 'Dev Admin',
      status: 'ACTIVE',
      roleId: adminRoleId,
    },
    update: {
      displayName: 'Dev Admin',
      status: 'ACTIVE',
      roleId: adminRoleId,
      deletedAt: null,
    },
  });

  await prisma.user.upsert({
    where: { phone: '+8801700000002' },
    create: {
      phone: '+8801700000002',
      displayName: 'Dev Mobile User',
      status: 'ACTIVE',
      roleId: userRoleId,
    },
    update: {
      displayName: 'Dev Mobile User',
      status: 'ACTIVE',
      roleId: userRoleId,
      deletedAt: null,
    },
  });
}
