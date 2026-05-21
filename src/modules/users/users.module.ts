import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { configureUsersRoutes } from './users.routes.js';
import { UsersService } from './users.service.js';

export class UsersModule extends BaseModule {
  private controller!: UsersController;

  get metadata(): ModuleMetadata {
    return {
      name: 'users',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'User management module',
    };
  }

  protected registerServices(): void {
    const repository = new UsersRepository();
    const service = new UsersService(repository);
    this.controller = new UsersController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureUsersRoutes(this.router, this.controller);
  }
}

export function createUsersModule(): UsersModule {
  return new UsersModule();
}
