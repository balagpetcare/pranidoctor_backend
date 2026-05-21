import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateUserDto, UpdateUserDto, UpdateUserProfileDto } from './users.dto.js';
import { usersEvents } from './users.events.js';
import type { UsersRepositoryInterface } from './users.repository.js';
import type { User, UserProfile, UserFilter } from './users.types.js';

export interface UsersServiceInterface extends ModuleService {
  create(data: CreateUserDto): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
  list(filter: UserFilter, page: number, pageSize: number): Promise<PaginatedResult<User>>;
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, data: UpdateUserProfileDto): Promise<UserProfile>;
  findOrCreateByPhone(phone: string): Promise<{ user: User; isNew: boolean }>;
}

export class UsersService implements UsersServiceInterface {
  readonly name = 'UsersService';

  constructor(private readonly repository: UsersRepositoryInterface) {}

  async create(data: CreateUserDto): Promise<User> {
    const user = await this.repository.create(data);

    await usersEvents.emitUserCreated({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      timestamp: new Date(),
    });

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repository.findByPhone(phone);
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.repository.update(id, data);

    await usersEvents.emitUserUpdated({
      userId: user.id,
      changes: Object.keys(data),
      timestamp: new Date(),
    });

    return user;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);

    await usersEvents.emitUserDeleted({
      userId: id,
      timestamp: new Date(),
    });
  }

  async list(filter: UserFilter, page: number, pageSize: number): Promise<PaginatedResult<User>> {
    return this.repository.list(filter, page, pageSize);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.repository.getProfile(userId);
  }

  async updateProfile(userId: string, data: UpdateUserProfileDto): Promise<UserProfile> {
    return this.repository.updateProfile(userId, data);
  }

  async findOrCreateByPhone(phone: string): Promise<{ user: User; isNew: boolean }> {
    const existing = await this.repository.findByPhone(phone);

    if (existing) {
      return { user: existing, isNew: false };
    }

    const user = await this.create({ phone });
    return { user, isNew: true };
  }
}
