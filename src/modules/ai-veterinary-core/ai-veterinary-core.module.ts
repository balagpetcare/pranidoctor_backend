import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { AiVeterinaryCoreController } from './ai-veterinary-core.controller.js';
import { configureAiVeterinaryCoreRoutes } from './ai-veterinary-core.routes.js';
import { getAiVeterinaryCoreService } from './ai-veterinary-core.service.js';
import { getAiVeterinaryRepository } from './repository/ai-veterinary.repository.js';
import { getAiSafetyService } from './safety/ai-safety.service.js';

export class AiVeterinaryCoreModule extends BaseModule {
  private controller!: AiVeterinaryCoreController;

  get metadata(): ModuleMetadata {
    return {
      name: 'ai',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'AI veterinary assistant — chat, triage, memory, escalation (no autonomous diagnosis)',
    };
  }

  protected registerServices(): void {
    this.controller = new AiVeterinaryCoreController();
    this.registerService(getAiVeterinaryCoreService());
    this.registerService(getAiVeterinaryRepository());
    this.registerService(getAiSafetyService());
  }

  protected configureRoutes(): void {
    configureAiVeterinaryCoreRoutes(this.router, this.controller);
  }
}

export function createAiVeterinaryCoreModule(): AiVeterinaryCoreModule {
  return new AiVeterinaryCoreModule();
}
