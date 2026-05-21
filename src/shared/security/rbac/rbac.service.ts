import type { UserRole, AuthUser } from '../types.js';
import { RoleHierarchy } from '../types.js';

import { PermissionGroups, type PermissionType } from './permissions.js';

const rolePermissions: Record<UserRole, readonly PermissionType[]> = {
  USER: PermissionGroups.USER_BASIC,
  SUPPORT: PermissionGroups.SUPPORT_PERMISSIONS,
  TECHNICIAN: PermissionGroups.TECHNICIAN_PERMISSIONS,
  DOCTOR: PermissionGroups.DOCTOR_PERMISSIONS,
  MANAGER: PermissionGroups.MANAGER_PERMISSIONS,
  ADMIN: PermissionGroups.ADMIN_PERMISSIONS,
  SUPER_ADMIN: PermissionGroups.SUPER_ADMIN_PERMISSIONS,
};

export function getRolePermissions(role: UserRole): readonly PermissionType[] {
  return rolePermissions[role] ?? [];
}

export function hasPermission(user: AuthUser, permission: PermissionType): boolean {
  const permissions = getRolePermissions(user.role);
  return permissions.includes(permission);
}

export function hasAnyPermission(user: AuthUser, permissions: PermissionType[]): boolean {
  const userPermissions = getRolePermissions(user.role);
  return permissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(user: AuthUser, permissions: PermissionType[]): boolean {
  const userPermissions = getRolePermissions(user.role);
  return permissions.every((p) => userPermissions.includes(p));
}

export function hasRole(user: AuthUser, role: UserRole): boolean {
  return user.role === role;
}

export function hasAnyRole(user: AuthUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

export function hasMinimumRole(user: AuthUser, minimumRole: UserRole): boolean {
  const userLevel = RoleHierarchy[user.role];
  const requiredLevel = RoleHierarchy[minimumRole];
  return userLevel >= requiredLevel;
}

export function isAdmin(user: AuthUser): boolean {
  return hasMinimumRole(user, 'ADMIN');
}

export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === 'SUPER_ADMIN';
}

export function canAccessResource(
  user: AuthUser,
  resourceOwnerId: string,
  requiredPermission: PermissionType
): boolean {
  if (user.id === resourceOwnerId) {
    return true;
  }

  return hasPermission(user, requiredPermission);
}

export function canModifyResource(
  user: AuthUser,
  resourceOwnerId: string,
  writePermission: PermissionType,
  adminPermission: PermissionType
): boolean {
  if (user.id === resourceOwnerId) {
    return true;
  }

  if (hasPermission(user, adminPermission)) {
    return true;
  }

  return hasPermission(user, writePermission);
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  missingPermissions?: PermissionType[];
}

export function checkPermissions(
  user: AuthUser,
  required: PermissionType[],
  requireAll = true
): PermissionCheckResult {
  const userPermissions = getRolePermissions(user.role);

  if (requireAll) {
    const missing = required.filter((p) => !userPermissions.includes(p));
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: 'Missing required permissions',
        missingPermissions: missing,
      };
    }
  } else {
    const hasAny = required.some((p) => userPermissions.includes(p));
    if (!hasAny) {
      return {
        allowed: false,
        reason: 'Missing any of the required permissions',
        missingPermissions: required,
      };
    }
  }

  return { allowed: true };
}

export function getEffectivePermissions(role: UserRole): Set<PermissionType> {
  return new Set(getRolePermissions(role));
}
