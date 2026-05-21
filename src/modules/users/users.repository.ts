import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

import {
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';
import { createPaginationMeta } from '../../shared/utils/pagination.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { getCustomerProfileService } from '../profile/customer-profile.service.js';

import type { CreateUserDto, UpdateUserDto, UpdateUserProfileDto } from './users.dto.js';
import type { User, UserProfile, UserFilter, UserRole, UserStatus } from './users.types.js';

export interface UsersRepositoryInterface extends ModuleService {
  create(data: CreateUserDto): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
  list(filter: UserFilter, _page: number, _pageSize: number): Promise<PaginatedResult<User>>;
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(_userId: string, _data: UpdateUserProfileDto): Promise<UserProfile>;
}

function mapPrismaRole(role: PrismaUserRole): UserRole {
  switch (role) {
    case PrismaUserRole.CUSTOMER:
      return 'USER';
    case PrismaUserRole.AI_TECHNICIAN:
      return 'TECHNICIAN';
    case PrismaUserRole.DOCTOR:
      return 'DOCTOR';
    case PrismaUserRole.ADMIN:
    case PrismaUserRole.SUPER_ADMIN:
      return 'ADMIN';
    case PrismaUserRole.SUPPORT:
      return 'SUPPORT';
    default:
      return 'USER';
  }
}

function mapPrismaStatus(status: PrismaUserStatus): UserStatus {
  switch (status) {
    case PrismaUserStatus.ACTIVE:
      return 'ACTIVE';
    case PrismaUserStatus.SUSPENDED:
      return 'SUSPENDED';
    case PrismaUserStatus.PENDING_VERIFICATION:
      return 'PENDING';
    case PrismaUserStatus.INVITED:
      return 'PENDING';
    case PrismaUserStatus.DELETED:
      return 'INACTIVE';
    default:
      return 'ACTIVE';
  }
}

function toFoundationUser(row: {
  id: string;
  phone: string | null;
  email: string;
  role: PrismaUserRole;
  status: PrismaUserStatus;
  createdAt: Date;
  updatedAt: Date;
  customerProfile?: { displayName: string; locale: string | null } | null;
}): User {
  return omitUndefined({
    id: row.id,
    phone: row.phone ?? '',
    name: row.customerProfile?.displayName,
    email: row.email,
    role: mapPrismaRole(row.role),
    status: mapPrismaStatus(row.status),
    language: row.customerProfile?.locale ?? 'bn-BD',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }) as User;
}

export class UsersRepository implements UsersRepositoryInterface {
  readonly name = 'UsersRepository';

  async create(data: CreateUserDto): Promise<User> {
    const prisma = getPrisma();
    const email =
      data.email?.trim().toLowerCase() ||
      `${data.phone.replace(/\D/g, '')}@users.pranidoctor.internal`;
    const passwordHash = await bcrypt.hash(randomBytes(16).toString('hex'), 10);

    const created = await prisma.user.create({
      data: {
        email,
        phone: data.phone,
        passwordHash,
        role: PrismaUserRole.CUSTOMER,
        status: PrismaUserStatus.ACTIVE,
        customerProfile: {
          create: {
            displayName: data.name?.trim() || `গ্রাহক ${data.phone.slice(-4)}`,
          },
        },
      },
      include: { customerProfile: true },
    });

    return toFoundationUser(created);
  }

  async findById(id: string): Promise<User | null> {
    const row = await getPrisma().user.findUnique({
      where: { id },
      include: { customerProfile: true },
    });
    return row ? toFoundationUser(row) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const row = await getPrisma().user.findFirst({
      where: { phone },
      include: { customerProfile: true },
    });
    return row ? toFoundationUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await getPrisma().user.findFirst({
      where: { email: email.toLowerCase() },
      include: { customerProfile: true },
    });
    return row ? toFoundationUser(row) : null;
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      if (data.email !== undefined) {
        await tx.user.update({ where: { id }, data: { email: data.email } });
      }
      if (data.name !== undefined || data.language !== undefined) {
        const cp = await tx.customerProfile.findUnique({ where: { userId: id } });
        if (cp) {
          await tx.customerProfile.update({
            where: { id: cp.id },
            data: {
              ...(data.name !== undefined ? { displayName: data.name } : {}),
              ...(data.language !== undefined ? { locale: data.language } : {}),
            },
          });
        }
      }
    });

    const fresh = await this.findById(id);
    if (!fresh) throw new Error('USER_NOT_FOUND');
    return fresh;
  }

  async delete(id: string): Promise<void> {
    await getPrisma().user.update({
      where: { id },
      data: { status: PrismaUserStatus.DELETED },
    });
  }

  async list(
    filter: UserFilter,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<User>> {
    const prisma = getPrisma();
    const where: Record<string, unknown> = {};
    if (filter.status) {
      const statusMap: Record<UserStatus, PrismaUserStatus> = {
        ACTIVE: PrismaUserStatus.ACTIVE,
        INACTIVE: PrismaUserStatus.DELETED,
        SUSPENDED: PrismaUserStatus.SUSPENDED,
        PENDING: PrismaUserStatus.PENDING_VERIFICATION,
      };
      where.status = statusMap[filter.status];
    }
    if (filter.search) {
      where.OR = [
        { phone: { contains: filter.search } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { customerProfile: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: rows.map(toFoundationUser),
      meta: createPaginationMeta(total, page, pageSize),
    };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const cp = await getPrisma().customerProfile.findUnique({
      where: { userId },
    });
    if (!cp) return null;

    const address =
      cp.addressJson && typeof cp.addressJson === 'object' && !Array.isArray(cp.addressJson)
        ? ((cp.addressJson as Record<string, unknown>).areaLabel as string | undefined)
        : undefined;

    return omitUndefined({
      userId,
      avatarUrl: cp.profilePhotoUrl ?? undefined,
      address,
      preferences: {
        notifications: true,
        language: cp.locale ?? 'bn-BD',
        theme: 'system' as const,
      },
    }) as UserProfile;
  }

  async updateProfile(userId: string, data: UpdateUserProfileDto): Promise<UserProfile> {
    await getCustomerProfileService().ensureCustomerProfile(userId);

    await getPrisma().customerProfile.update({
      where: { userId },
      data: {
        ...(data.avatarUrl !== undefined ? { profilePhotoUrl: data.avatarUrl } : {}),
        ...(data.preferences?.language !== undefined
          ? { locale: data.preferences.language }
          : {}),
      },
    });

    const profile = await this.getProfile(userId);
    if (!profile) throw new Error('PROFILE_NOT_FOUND');
    return profile;
  }
}
