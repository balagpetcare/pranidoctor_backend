export { createAuthModule, AuthModule } from './auth/index.js';
export { createUsersModule, UsersModule } from './users/index.js';
export { createDoctorsModule, DoctorsModule } from './doctors/index.js';
export { createLeadsModule, LeadsModule } from './leads/index.js';
export { createAnimalsModule, AnimalsModule } from './animals/index.js';
export { createClinicsModule, ClinicsModule } from './clinics/index.js';
export { createAiVeterinaryCoreModule, AiVeterinaryCoreModule } from './ai-veterinary-core/index.js';
export { createNotificationsModule, NotificationsModule } from './notifications/index.js';
export { createMediaModule, MediaModule } from './media/index.js';
export { createIdentityModule, IdentityModule } from './identity/index.js';
export { createAreaEngineModule, AreaEngineModule } from './area-engine/index.js';
export { createTreatmentWorkflowModule, TreatmentWorkflowModule } from './treatment-workflow/index.js';
export { createVoiceAssistantModule, VoiceAssistantModule } from './voice-assistant/index.js';
export { createSyncModule, SyncModule, createOfflineModule, OfflineModule } from './offline-architecture/index.js';

import { createAuthModule } from './auth/index.js';
import { createUsersModule } from './users/index.js';
import { createDoctorsModule } from './doctors/index.js';
import { createLeadsModule } from './leads/index.js';
import { createAnimalsModule } from './animals/index.js';
import { createClinicsModule } from './clinics/index.js';
import { createAiVeterinaryCoreModule } from './ai-veterinary-core/index.js';
import { createNotificationsModule } from './notifications/index.js';
import { createMediaModule } from './media/index.js';
import { createIdentityModule } from './identity/index.js';
import { createAreaEngineModule } from './area-engine/index.js';
import { createTreatmentWorkflowModule } from './treatment-workflow/index.js';
import { createVoiceAssistantModule } from './voice-assistant/index.js';
import { createSyncModule, createOfflineModule } from './offline-architecture/index.js';
import type { ModuleDefinition } from '../shared/module/module.types.js';

export function createAllModules(): ModuleDefinition[] {
  return [
    createAuthModule(),
    createIdentityModule(),
    createAreaEngineModule(),
    createTreatmentWorkflowModule(),
    createVoiceAssistantModule(),
    createSyncModule(),
    createOfflineModule(),
    createUsersModule(),
    createDoctorsModule(),
    createLeadsModule(),
    createAnimalsModule(),
    createClinicsModule(),
    createNotificationsModule(),
    createAiVeterinaryCoreModule(),
    createMediaModule(),
  ];
}
