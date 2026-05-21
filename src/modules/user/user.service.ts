import type { ModuleService } from '../../shared/module/module.types.js';

import type { UserRepositoryInterface } from './user.repository.js';
import type { CustomerUserRow, FindOrCreateCustomerResult } from './user.types.js';

export interface UserServiceInterface extends ModuleService {
  findById(id: string): Promise<CustomerUserRow | null>;
  findByPhone(phone: string): Promise<CustomerUserRow | null>;
  findByEmail(email: string): Promise<CustomerUserRow | null>;
  findOrCreateCustomerByPhone(
    phone: string,
    displayNameHint?: string,
  ): Promise<FindOrCreateCustomerResult>;
}

export class UserService implements UserServiceInterface {
  readonly name = 'UserService';

  constructor(private readonly repository: UserRepositoryInterface) {}

  findById(id: string): Promise<CustomerUserRow | null> {
    return this.repository.findById(id);
  }

  findByPhone(phone: string): Promise<CustomerUserRow | null> {
    return this.repository.findByPhone(phone);
  }

  findByEmail(email: string): Promise<CustomerUserRow | null> {
    return this.repository.findByEmail(email);
  }

  findOrCreateCustomerByPhone(
    phone: string,
    displayNameHint?: string,
  ): Promise<FindOrCreateCustomerResult> {
    return this.repository.findOrCreateCustomerByPhone(phone, displayNameHint);
  }
}

import { UserRepository } from './user.repository.js';

let defaultUserService: UserService | null = null;

export function getUserService(): UserService {
  if (!defaultUserService) {
    defaultUserService = new UserService(new UserRepository());
  }
  return defaultUserService;
}
