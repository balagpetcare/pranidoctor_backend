import type { PrismaClient } from '../../src/generated/prisma/index.js';

export const ROLE_DEFINITIONS = [
  {
    name: 'USER',
    displayName: 'User',
    description: 'Mobile app customer',
    level: 1,
    permissions: [
      'users:read',
      'animals:read',
      'animals:write',
      'ai:chat',
      'notifications:read',
    ],
  },
  {
    name: 'SUPPORT',
    displayName: 'Support',
    description: 'Customer support agent',
    level: 2,
    permissions: [
      'users:read',
      'leads:read',
      'leads:write',
      'animals:read',
      'ai:history:read',
      'notifications:read',
    ],
  },
  {
    name: 'TECHNICIAN',
    displayName: 'Technician',
    description: 'AI technician field worker',
    level: 3,
    permissions: [
      'users:read',
      'leads:read',
      'leads:write',
      'leads:assign',
      'animals:read',
      'ai:chat',
      'notifications:read',
    ],
  },
  {
    name: 'DOCTOR',
    displayName: 'Doctor',
    description: 'Licensed veterinarian',
    level: 4,
    permissions: [
      'users:read',
      'doctors:read',
      'doctors:write',
      'animals:read',
      'animals:medical:read',
      'animals:medical:write',
      'ai:chat',
      'ai:history:read',
      'notifications:read',
      'notifications:send',
      'reports:read',
    ],
  },
  {
    name: 'MANAGER',
    displayName: 'Manager',
    description: 'Operations manager',
    level: 5,
    permissions: [
      'users:read',
      'users:write',
      'doctors:read',
      'doctors:write',
      'clinics:read',
      'clinics:write',
      'leads:read',
      'leads:write',
      'leads:assign',
      'leads:convert',
      'reports:read',
      'reports:generate',
      'settings:read',
    ],
  },
  {
    name: 'ADMIN',
    displayName: 'Administrator',
    description: 'Platform administrator',
    level: 6,
    permissions: [
      'users:read',
      'users:write',
      'users:delete',
      'users:admin',
      'doctors:read',
      'doctors:write',
      'doctors:verify',
      'doctors:admin',
      'clinics:admin',
      'leads:admin',
      'ai:admin',
      'notifications:admin',
      'reports:export',
      'audit:read',
      'settings:read',
      'settings:write',
    ],
  },
  {
    name: 'SUPER_ADMIN',
    displayName: 'Super Administrator',
    description: 'Full system access',
    level: 7,
    permissions: ['system:admin', 'system:config'],
  },
] as const;

export async function seedRoles(prisma: PrismaClient): Promise<Map<string, string>> {
  const roleIds = new Map<string, string>();

  for (const role of ROLE_DEFINITIONS) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        level: role.level,
        permissions: role.permissions,
        isSystem: true,
      },
      update: {
        displayName: role.displayName,
        description: role.description,
        level: role.level,
        permissions: role.permissions,
      },
    });

    roleIds.set(role.name, record.id);
  }

  return roleIds;
}
