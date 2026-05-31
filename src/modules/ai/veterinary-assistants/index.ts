export {
  VETERINARY_ASSISTANT_IDS,
  type VeterinaryAssistantId,
  type VeterinaryAssistantConfig,
  type VeterinaryAssistantRequest,
  type VeterinaryAssistantResponse,
} from './veterinary-assistant.types.js';
export {
  VETERINARY_ASSISTANTS,
  getVeterinaryAssistantConfig,
  listVeterinaryAssistants,
} from './assistant-registry.js';
export {
  VeterinaryAssistantService,
  getVeterinaryAssistantService,
  resetVeterinaryAssistantServiceForTests,
} from './veterinary-assistant.service.js';
