import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { VoiceAssistantController } from './voice-assistant.controller.js';
import { configureVoiceAssistantRoutes } from './voice-assistant.routes.js';
import { getVoiceRepository } from './repository/voice.repository.js';
import { getVoiceAssistantService } from './voice-assistant.service.js';

export class VoiceAssistantModule extends BaseModule {
  private controller!: VoiceAssistantController;

  get metadata(): ModuleMetadata {
    return {
      name: 'voice',
      version: '1.0.0',
      dependencies: ['auth', 'ai'],
      description: 'Bangla voice assistant — STT, chat orchestration, navigation (independent of AI provider)',
    };
  }

  protected registerServices(): void {
    this.controller = new VoiceAssistantController();
    this.registerService(getVoiceAssistantService());
    this.registerService(getVoiceRepository());
  }

  protected configureRoutes(): void {
    configureVoiceAssistantRoutes(this.router, this.controller);
  }
}

export function createVoiceAssistantModule(): VoiceAssistantModule {
  return new VoiceAssistantModule();
}
