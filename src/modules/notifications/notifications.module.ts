import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsRepository } from './notifications.repository.js';
import { configureNotificationsRoutes } from './notifications.routes.js';
import { NotificationsService } from './notifications.service.js';

export class NotificationsModule extends BaseModule {
  private controller!: NotificationsController;

  get metadata(): ModuleMetadata {
    return {
      name: 'notifications',
      version: '1.0.0',
      dependencies: ['auth', 'users'],
      description: 'Notification management module (SMS, Email, Push, In-App)',
    };
  }

  protected registerServices(): void {
    const repository = new NotificationsRepository();
    const service = new NotificationsService(repository);
    this.controller = new NotificationsController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureNotificationsRoutes(this.router, this.controller);
  }
}

export function createNotificationsModule(): NotificationsModule {
  return new NotificationsModule();
}
