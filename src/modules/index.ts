export { createAuthModule, AuthModule } from './auth/index.js';
export { createUsersModule, UsersModule } from './users/index.js';
export { createDoctorsModule, DoctorsModule } from './doctors/index.js';
export { createLeadsModule, LeadsModule } from './leads/index.js';
export { createAnimalsModule, AnimalsModule } from './animals/index.js';
export { createClinicsModule, ClinicsModule } from './clinics/index.js';
export { createAiModule, AiModule } from './ai/index.js';
export { createNotificationsModule, NotificationsModule } from './notifications/index.js';
export { createMediaModule, MediaModule } from './media/index.js';

import { createAuthModule } from './auth/index.js';
import { createUsersModule } from './users/index.js';
import { createDoctorsModule } from './doctors/index.js';
import { createLeadsModule } from './leads/index.js';
import { createAnimalsModule } from './animals/index.js';
import { createClinicsModule } from './clinics/index.js';
import { createAiModule } from './ai/index.js';
import { createNotificationsModule } from './notifications/index.js';
import { createMediaModule } from './media/index.js';
import type { ModuleDefinition } from '../shared/module/module.types.js';

export function createAllModules(): ModuleDefinition[] {
  return [
    createAuthModule(),
    createUsersModule(),
    createDoctorsModule(),
    createLeadsModule(),
    createAnimalsModule(),
    createClinicsModule(),
    createNotificationsModule(),
    createAiModule(),
    createMediaModule(),
  ];
}
