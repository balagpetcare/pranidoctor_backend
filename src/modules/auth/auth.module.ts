import { getConfig } from '../../shared/config/index.js';
import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { AuthController } from './auth.controller.js';
import { configureAuthRoutes } from './auth.routes.js';
import { createAuthService } from './auth.service.js';

export class AuthModule extends BaseModule {
  private controller!: AuthController;

  get metadata(): ModuleMetadata {
    return {
      name: 'auth',
      version: '1.0.0',
      dependencies: [],
      description: 'Authentication module - OTP, JWT, sessions',
    };
  }

  protected registerServices(): void {
    const config = getConfig();

    const service = createAuthService(config);
    this.controller = new AuthController(service, config);

    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureAuthRoutes(this.router, this.controller);
  }
}

export function createAuthModule(): AuthModule {
  return new AuthModule();
}
