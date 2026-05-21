import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { IdentityController } from './identity.controller.js';
import { configureIdentityRoutes } from './identity.routes.js';

export class IdentityModule extends BaseModule {
  private controller!: IdentityController;

  get metadata(): ModuleMetadata {
    return {
      name: 'identity',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Identity orchestration — login capabilities, session facade, profile summary',
    };
  }

  protected registerServices(): void {
    this.controller = new IdentityController();
    this.registerService({
      name: 'IdentityController',
    });
  }

  protected configureRoutes(): void {
    configureIdentityRoutes(this.router, this.controller);
  }
}

export function createIdentityModule(): IdentityModule {
  return new IdentityModule();
}
