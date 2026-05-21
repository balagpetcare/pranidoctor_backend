import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { AiController } from './ai.controller.js';
import { AiRepository } from './ai.repository.js';
import { configureAiRoutes } from './ai.routes.js';
import { AiService } from './ai.service.js';

export class AiModule extends BaseModule {
  private controller!: AiController;

  get metadata(): ModuleMetadata {
    return {
      name: 'ai',
      version: '1.0.0',
      dependencies: ['auth', 'users', 'notifications'],
      description: 'AI chat and conversation management module',
    };
  }

  protected registerServices(): void {
    const repository = new AiRepository();
    const service = new AiService(repository);
    this.controller = new AiController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureAiRoutes(this.router, this.controller);
  }
}

export function createAiModule(): AiModule {
  return new AiModule();
}
