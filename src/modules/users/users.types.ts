export interface User {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  language: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'USER' | 'ADMIN' | 'DOCTOR' | 'TECHNICIAN' | 'SUPPORT' | 'MANAGER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

export interface UserProfile {
  userId: string;
  avatarUrl?: string;
  address?: string;
  district?: string;
  division?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

export interface UserFilter {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  tenantId?: string;
}
