export const Permission = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  USERS_ADMIN: 'users:admin',

  DOCTORS_READ: 'doctors:read',
  DOCTORS_WRITE: 'doctors:write',
  DOCTORS_VERIFY: 'doctors:verify',
  DOCTORS_ADMIN: 'doctors:admin',

  CLINICS_READ: 'clinics:read',
  CLINICS_WRITE: 'clinics:write',
  CLINICS_ADMIN: 'clinics:admin',

  ANIMALS_READ: 'animals:read',
  ANIMALS_WRITE: 'animals:write',
  ANIMALS_MEDICAL_READ: 'animals:medical:read',
  ANIMALS_MEDICAL_WRITE: 'animals:medical:write',

  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  LEADS_ASSIGN: 'leads:assign',
  LEADS_CONVERT: 'leads:convert',
  LEADS_ADMIN: 'leads:admin',

  AI_CHAT: 'ai:chat',
  AI_HISTORY_READ: 'ai:history:read',
  AI_ADMIN: 'ai:admin',

  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_SEND: 'notifications:send',
  NOTIFICATIONS_ADMIN: 'notifications:admin',

  REPORTS_READ: 'reports:read',
  REPORTS_GENERATE: 'reports:generate',
  REPORTS_EXPORT: 'reports:export',

  AUDIT_READ: 'audit:read',

  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',

  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_CONFIG: 'system:config',
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

export const PermissionGroups = {
  USER_BASIC: [
    Permission.USERS_READ,
    Permission.ANIMALS_READ,
    Permission.ANIMALS_WRITE,
    Permission.AI_CHAT,
    Permission.NOTIFICATIONS_READ,
  ],

  DOCTOR_PERMISSIONS: [
    Permission.USERS_READ,
    Permission.DOCTORS_READ,
    Permission.DOCTORS_WRITE,
    Permission.ANIMALS_READ,
    Permission.ANIMALS_MEDICAL_READ,
    Permission.ANIMALS_MEDICAL_WRITE,
    Permission.AI_CHAT,
    Permission.AI_HISTORY_READ,
    Permission.NOTIFICATIONS_READ,
    Permission.NOTIFICATIONS_SEND,
    Permission.REPORTS_READ,
  ],

  TECHNICIAN_PERMISSIONS: [
    Permission.USERS_READ,
    Permission.LEADS_READ,
    Permission.LEADS_WRITE,
    Permission.LEADS_ASSIGN,
    Permission.ANIMALS_READ,
    Permission.AI_CHAT,
    Permission.NOTIFICATIONS_READ,
  ],

  SUPPORT_PERMISSIONS: [
    Permission.USERS_READ,
    Permission.LEADS_READ,
    Permission.LEADS_WRITE,
    Permission.ANIMALS_READ,
    Permission.AI_HISTORY_READ,
    Permission.NOTIFICATIONS_READ,
  ],

  MANAGER_PERMISSIONS: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.DOCTORS_READ,
    Permission.DOCTORS_WRITE,
    Permission.CLINICS_READ,
    Permission.CLINICS_WRITE,
    Permission.ANIMALS_READ,
    Permission.LEADS_READ,
    Permission.LEADS_WRITE,
    Permission.LEADS_ASSIGN,
    Permission.LEADS_CONVERT,
    Permission.AI_HISTORY_READ,
    Permission.NOTIFICATIONS_READ,
    Permission.NOTIFICATIONS_SEND,
    Permission.REPORTS_READ,
    Permission.REPORTS_GENERATE,
    Permission.SETTINGS_READ,
  ],

  ADMIN_PERMISSIONS: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_DELETE,
    Permission.USERS_ADMIN,
    Permission.DOCTORS_READ,
    Permission.DOCTORS_WRITE,
    Permission.DOCTORS_VERIFY,
    Permission.DOCTORS_ADMIN,
    Permission.CLINICS_READ,
    Permission.CLINICS_WRITE,
    Permission.CLINICS_ADMIN,
    Permission.ANIMALS_READ,
    Permission.ANIMALS_WRITE,
    Permission.ANIMALS_MEDICAL_READ,
    Permission.ANIMALS_MEDICAL_WRITE,
    Permission.LEADS_READ,
    Permission.LEADS_WRITE,
    Permission.LEADS_ASSIGN,
    Permission.LEADS_CONVERT,
    Permission.LEADS_ADMIN,
    Permission.AI_CHAT,
    Permission.AI_HISTORY_READ,
    Permission.AI_ADMIN,
    Permission.NOTIFICATIONS_READ,
    Permission.NOTIFICATIONS_SEND,
    Permission.NOTIFICATIONS_ADMIN,
    Permission.REPORTS_READ,
    Permission.REPORTS_GENERATE,
    Permission.REPORTS_EXPORT,
    Permission.AUDIT_READ,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_WRITE,
  ],

  SUPER_ADMIN_PERMISSIONS: [
    ...Object.values(Permission),
  ],
} as const;
