import type { User, UserProfile, UserRole, UserStatus } from './users.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface CreateUserDto {
  phone: string;
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  language?: string;
}

export interface UpdateUserProfileDto {
  avatarUrl?: string;
  address?: string;
  district?: string;
  division?: string;
  preferences?: {
    notifications?: boolean;
    language?: string;
    theme?: 'light' | 'dark' | 'system';
  };
}

export interface UserResponseDto {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  language: string;
  createdAt: string;
}

export interface UserProfileResponseDto {
  userId: string;
  avatarUrl?: string;
  address?: string;
  district?: string;
  division?: string;
  preferences: {
    notifications: boolean;
    language: string;
    theme: string;
  };
}

export function toUserResponseDto(user: User): UserResponseDto {
  return omitUndefined({
    id: user.id,
    phone: user.phone,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    language: user.language,
    createdAt: user.createdAt.toISOString(),
  });
}

export function toUserProfileResponseDto(profile: UserProfile): UserProfileResponseDto {
  return omitUndefined({
    userId: profile.userId,
    avatarUrl: profile.avatarUrl,
    address: profile.address,
    district: profile.district,
    division: profile.division,
    preferences: {
      notifications: profile.preferences.notifications,
      language: profile.preferences.language,
      theme: profile.preferences.theme,
    },
  });
}
