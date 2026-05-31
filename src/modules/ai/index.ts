export {
  createAiModule,
  createAiAdminModule,
  AiModule,
  AiAdminModule,
} from './ai.module.js';
export { AiController, AiAdminController } from './ai.controller.js';
export { getAiOrchestratorService } from './orchestrator/ai-orchestrator.service.js';
export {
  getAiProviderRegistry,
  getAiProviderFactory,
  getAiProviderDiscovery,
  ensureAiProvidersBootstrapped,
  type IAIProvider,
  type AiProviderKey,
  type DiscoveredProvider,
} from './providers/index.js';
export {
  getAIRouterService,
  type AiTaskType,
  type ResolvedRoute,
  type RouteHop,
  normalizeAiTaskType,
  AI_TASK_TYPES,
} from './routing/index.js';
export {
  getAIFailoverService,
  getAIHealthService,
  getAIProviderMonitor,
  type FailoverExecutionResult,
  type ProviderHealthSnapshot,
  type FailoverTier,
} from './failover/index.js';
export {
  getAiRouterEngine,
  getModelInvocationAdapter,
  getProviderAdapterFactory,
  getTimeoutEngine,
  getRetryEngine,
  getFallbackEngine,
  getRouterHealthMonitor,
} from './router/index.js';
export {
  getAiUsageAnalyticsService,
  getAiUsageReportService,
  type UsageAnalyticsDashboard,
  type UsageAnalyticsFilters,
} from './analytics/usage/index.js';
export { getAiKnowledgeService } from './knowledge/ai-knowledge.service.js';
export {
  getKnowledgeSourceRegistryService,
  getKnowledgeImportPipelineService,
  getKnowledgeEditorialWorkflowService,
  getKnowledgeVetApprovalWorkflowService,
  getKnowledgePublishWorkflowService,
  buildChunksForEntry,
  computeConfidenceScore,
  assignProvisionalEvidenceLevel,
} from './knowledge-ingestion/index.js';
export {
  getKnowledgeRetrievalService,
  getKnowledgeEmbeddingPipelineService,
  getKnowledgeEmbeddingService,
  type KnowledgeContextPack,
  type RetrievalRequest,
} from './knowledge-retrieval/index.js';
export { getSymptomCheckerService } from './symptom-checker/symptom-checker.service.js';
export { getSmartRecommendationService } from './recommendations/smart-recommendation.service.js';
export { getFarmHealthService } from './farm-health/farm-health.service.js';
export { getAiAnalyticsService } from './analytics/ai-analytics.service.js';
export { getAiAssistantService } from './assistant/ai-assistant.service.js';
export {
  getKnowledgeFoundationService,
  configureKnowledgeFoundationAdminRoutes,
  knowledgeFoundationCan,
  KNOWLEDGE_FOUNDATION_SCHEMA_VERSION,
} from './knowledge-foundation/index.js';
export {
  configureUvkgAdminRoutes,
  getGraphSyncService,
  getUvkgDualWriteService,
  getUvkgTraversalService,
  resolveUvkgConfig,
} from './uvkg/index.js';
export {
  getAiDoctorOrchestratorService,
  getAiDoctorSessionEngine,
  getSymptomIntakeEngine,
  getDifferentialDiagnosisEngine,
  getEmergencyDetectionEngine,
  getConfidenceEngine,
  getVetEscalationEngine,
  type AiDoctorCase,
  type AnalyzeCaseResult,
} from './ai-doctor/index.js';
export {
  getVeterinaryAssistantService,
  listVeterinaryAssistants,
  VETERINARY_ASSISTANT_IDS,
  type VeterinaryAssistantId,
  type VeterinaryAssistantResponse,
} from './veterinary-assistants/index.js';
export {
  getKnowledgeImportOrchestratorService,
  configureKnowledgeImportAdminRoutes,
  KNOWLEDGE_IMPORT_PIPELINE_VERSION,
  SOURCE_FAMILY_PROFILES,
} from './knowledge-import/index.js';
export {
  getKnowledgeChunkingOrchestratorService,
  KNOWLEDGE_CHUNKING_SCHEMA_VERSION,
  resolveChunkPolicyForDomain,
} from './knowledge-chunking/index.js';
export {
  getKnowledgeGovernanceOrchestratorService,
  KNOWLEDGE_GOVERNANCE_SCHEMA_VERSION,
  resolveGovernanceStage,
  requiresVetReviewPath,
  isExpeditedEligible,
} from './knowledge-governance/index.js';
export {
  getKnowledgeSeederService,
  KNOWLEDGE_SEEDER_SCHEMA_VERSION,
  SEEDER_DOMAINS,
  listDomainTemplates,
  KNOWLEDGE_IMPORT_CSV_HEADERS,
  resetAllKnowledgeSeederForTests,
  type SeederDomain,
  type SeederBatchManifest,
} from './knowledge-seeder/index.js';
export { createAiAdminRouteHandler } from './ai-admin.http.js';
export {
  getAiPromptManagementService,
  getPromptVersionService,
  type PromptView,
  type PromptKind,
  type CreatePromptInput,
  type UpdatePromptDraftInput,
  type ResolvedPrompt,
} from './prompts/management/index.js';
export {
  getAiFoundationService,
  resetAiFoundationServiceForTests,
  resolveTaskTypeForFeature,
} from './foundation/index.js';
export {
  getAiSettingsService,
  getAiSettingsRepository,
} from './settings/index.js';
export { getAiCostRateService } from './usage/ai-cost-rate.service.js';
export { getAiPlatformAuditService } from './audit/ai-platform-audit.service.js';
export {
  getAiSettingsAdminService,
  getAiFoundationAdminService,
  aiAdminCan,
} from './admin/index.js';
export {
  getMarketplaceBootstrapService,
  getExtensionLoaderService,
  getExternalModelRegistrationService,
  getVeterinaryModelService,
  getOpenRouterCatalogService,
  getAiAdapterRegistry,
  AI_ADAPTER_TYPES,
  VETERINARY_MODEL_CATEGORIES,
  type ExtensionManifest,
} from './marketplace/index.js';
