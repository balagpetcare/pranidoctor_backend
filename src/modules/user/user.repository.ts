import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

import { UserRole, UserStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import type { ModuleService } from '../../shared/module/module.types.js';

import type { CustomerUserRow, FindOrCreateCustomerResult, UserActivationResult } from './user.types.js';

export interface UserRepositoryInterface extends ModuleService {
  findById(id: string): Promise<CustomerUserRow | null>;
  findByPhone(phone: string): Promise<CustomerUserRow | null>;
  findByEmail(email: string): Promise<CustomerUserRow | null>;
  findOrCreateCustomerByPhone(phone: string, displayNameHint?: string): Promise<FindOrCreateCustomerResult>;
  setCustomerStatus(userId: string, status: UserStatus): Promise<UserActivationResult | null>;
  isCustomerActive(userId: string): Promise<boolean>;
}

export class UserRepository implements UserRepositoryInterface {
  readonly name = 'UserRepository';

  async findById(id: string): Promise<CustomerUserRow | null> {
    const row = await getPrisma().user.findUnique({ where: { id } });
    return row ?? null;
  }

  async findByPhone(phone: string): Promise<CustomerUserRow | null> {
    const row = await getPrisma().user.findFirst({ where: { phone } });
    return row ?? null;
  }

  async findByEmail(email: string): Promise<CustomerUserRow | null> {
    const row = await getPrisma().user.findFirst({
      where: { email: email.toLowerCase() },
    });
    return row ?? null;
  }

  async findOrCreateCustomerByPhone(
    phone: string,
    displayNameHint?: string,
  ): Promise<FindOrCreateCustomerResult> {
    const prisma = getPrisma();
    const existing = await prisma.user.findFirst({
      where: { phone },
      include: { customerProfile: true },
    });

    if (existing) {
      if (
        existing.role !== UserRole.CUSTOMER ||
        existing.status !== UserStatus.ACTIVE
      ) {
        throw new Error('USER_NOT_CUSTOMER');
      }
      if (!existing.customerProfile) {
        await prisma.customerProfile.create({
          data: {
            userId: existing.id,
            displayName: displayNameHint?.trim() || `গ্রাহক ${phone.slice(-4)}`,
          },
        });
      }
      return { userId: existing.id, isNew: false };
    }

    const email = `${phone}@mobile-otp.pranidoctor.internal`;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    const displayName =
      displayNameHint?.trim() || `গ্রাহক ${phone.slice(-4)}`;

    const created = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        customerProfile: {
          create: { displayName },
        },
      },
    });

    return { userId: created.id, isNew: true };
  }

  async setCustomerStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserActivationResult | null> {
    const row = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!row || row.role !== UserRole.CUSTOMER) {
      return null;
    }

    if (row.status === status) {
      return { userId, status, changed: false };
    }

    const updated = await getPrisma().user.update({
      where: { id: userId },
      data: { status },
    });

    return { userId, status: updated.status, changed: true };
  }

  async isCustomerActive(userId: string): Promise<boolean> {
    const row = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    return row?.role === UserRole.CUSTOMER && row.status === UserStatus.ACTIVE;
  }
}
