import type { UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from '../../generated/prisma/index.js';

export type PrismaRole = PrismaUserRole;
export type PrismaStatus = PrismaUserStatus;

export type CustomerUserRow = {
  id: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: PrismaUserRole;
  status: PrismaUserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type FindOrCreateCustomerResult = {
  userId: string;
  isNew: boolean;
};
