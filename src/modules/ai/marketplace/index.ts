export {
  AI_ADAPTER_TYPES,
  VETERINARY_MODEL_CATEGORIES,
  extensionManifestSchema,
  registerExternalModelSchema,
} from './marketplace.types.js';
export type {
  AiAdapterType,
  VeterinaryModelCategory,
  AiModelSourceType,
  ExtensionManifest,
  ExtensionManifestModel,
  ExtensionRegistrationContext,
  RegisteredExtensionView,
  ExternalModelRegistrationInput,
  OpenRouterModelCatalogEntry,
} from './marketplace.types.js';
export {
  AiAdapterRegistry,
  getAiAdapterRegistry,
  registerBuiltinAdapters,
  resetAiAdapterRegistryForTests,
} from './adapter-registry.js';
export { DynamicOpenAiCompatibleProvider } from './adapters/dynamic-openai.provider.js';
export { SelfHostedLlmProvider, createSelfHostedProvider } from './adapters/self-hosted.provider.js';
export {
  ExtensionLoaderService,
  getExtensionLoaderService,
  resetExtensionLoaderServiceForTests,
} from './extension-loader.service.js';
export {
  ExternalModelRegistrationService,
  getExternalModelRegistrationService,
  resetExternalModelRegistrationServiceForTests,
} from './external-model.service.js';
export {
  VeterinaryModelService,
  getVeterinaryModelService,
  resetVeterinaryModelServiceForTests,
} from './veterinary-model.service.js';
export {
  OpenRouterCatalogService,
  getOpenRouterCatalogService,
  resetOpenRouterCatalogServiceForTests,
} from './openrouter-catalog.service.js';
export {
  MarketplaceBootstrapService,
  getMarketplaceBootstrapService,
  resetMarketplaceBootstrapServiceForTests,
} from './marketplace-bootstrap.service.js';
