import { getConfig } from '../../shared/config/index.js';
import { getStorage, initializeStorage } from './storage/index.js';
import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { MediaController } from './media.controller.js';
import { MediaRepository } from './media.repository.js';
import { configureMediaRoutes } from './media.routes.js';
import { MediaService } from './media.service.js';

export class MediaModule extends BaseModule {
  private controller!: MediaController;

  get metadata(): ModuleMetadata {
    return {
      name: 'media',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Media upload, storage, and signed URL module',
    };
  }

  protected registerServices(): void {
    const config = getConfig();
    initializeStorage(config);

    const repository = new MediaRepository();
    const storage = getStorage();
    const service = new MediaService(repository, storage, config);
    this.controller = new MediaController();

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureMediaRoutes(this.router, this.controller, getConfig());
  }
}

export function createMediaModule(): MediaModule {
  return new MediaModule();
}
