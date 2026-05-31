import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { getAiVeterinaryCoreService } from '../ai-veterinary-core/ai-veterinary-core.service.js';
import { getAiVeterinaryRepository } from '../ai-veterinary-core/repository/ai-veterinary.repository.js';
import { getAiSafetyService } from '../ai-veterinary-core/safety/ai-safety.service.js';

import { AiAdminController, AiController } from './ai.controller.js';
import { configureAiAdminRoutes, configureAiRoutes } from './ai.routes.js';
import { getAiAnalyticsService } from './analytics/ai-analytics.service.js';
import {
  getAiCostAnalyticsService,
  getAiMetricsAggregatorService,
  getAiModelAnalyticsService,
  getAiPerformanceAnalyticsService,
  getAiProviderAnalyticsService,
  getAiUsageAnalyticsSummaryService,
} from './analytics/metrics/index.js';
import { getAiAssistantService } from './assistant/ai-assistant.service.js';
import { getVeterinaryAssistantService } from './veterinary-assistants/index.js';
import { getAiDoctorOrchestratorService } from './ai-doctor/index.js';
import { getAiPrescriptionOrchestratorService } from './ai-prescription/index.js';
import { getAiAuditService } from './audit/ai-audit.service.js';
import { getAiPlatformAuditService } from './audit/ai-platform-audit.service.js';
import { getFarmHealthService } from './farm-health/farm-health.service.js';
import { getAiFoundationService } from './foundation/ai-foundation.service.js';
import { getAiSettingsRepository } from './settings/ai-settings.repository.js';
import { getAiSettingsService } from './settings/ai-settings.service.js';
import {
  getAiModelRepository,
  getAiProviderRepository,
} from './repositories/ai-platform.repository.js';
import { getAiCostRateService } from './usage/ai-cost-rate.service.js';
import { getFollowUpService } from './follow-up/follow-up.service.js';
import { getAiKnowledgeService } from './knowledge/ai-knowledge.service.js';
import {
  getKnowledgeEditorialWorkflowService,
  getKnowledgeImportPipelineService,
  getKnowledgePublishWorkflowService,
  getKnowledgeSourceRegistryService,
  getKnowledgeVetApprovalWorkflowService,
} from './knowledge-ingestion/index.js';
import {
  getKnowledgeEmbeddingPipelineService,
  getKnowledgeEmbeddingService,
  getKnowledgeRetrievalService,
} from './knowledge-retrieval/index.js';
import { getNotificationIntelligenceService } from './notifications/notification-intelligence.service.js';
import { getAiOrchestratorService } from './orchestrator/ai-orchestrator.service.js';
import { getAiPromptService } from './prompts/ai-prompt.service.js';
import { getAiPromptManagementService } from './prompts/management/ai-prompt-management.service.js';
import { getSmartRecommendationService } from './recommendations/smart-recommendation.service.js';
import { getRiskScoringService } from './risk/risk-scoring.service.js';
import { getSymptomCheckerService } from './symptom-checker/symptom-checker.service.js';
import { getAiUsageService } from './usage/ai-usage.service.js';
import { getAiRepository } from './ai.repository.js';
import { getKnowledgeFoundationService } from './knowledge-foundation/index.js';
import { configureKnowledgeFoundationAdminRoutes } from './knowledge-foundation/knowledge-foundation.routes.js';
import { configureUvkgAdminRoutes } from './uvkg/uvkg.routes.js';
import { getGraphSyncService } from './uvkg/services/graph-sync.service.js';
import { getKnowledgeImportOrchestratorService } from './knowledge-import/index.js';
import { configureKnowledgeImportAdminRoutes } from './knowledge-import/knowledge-import.routes.js';
import { getKnowledgeChunkingOrchestratorService } from './knowledge-chunking/index.js';
import { getKnowledgeGovernanceOrchestratorService } from './knowledge-governance/index.js';
import { DiseaseIntelligenceController } from './disease-intelligence/disease-intelligence.controller.js';
import {
  configureDiseaseIntelligenceAdminRoutes,
  configureDiseaseIntelligenceRoutes,
  configureDiseaseVetRoutes,
} from './disease-intelligence/disease-intelligence.routes.js';
import { getDiseaseReasoningOrchestratorService } from './disease-intelligence/index.js';

export class AiModule extends BaseModule {
  private controller!: AiController;
  private diseaseController!: DiseaseIntelligenceController;

  get metadata(): ModuleMetadata {
    return {
      name: 'ai',
      version: '2.0.0',
      dependencies: ['auth'],
      description: 'Phase 8 AI ecosystem — assistant, symptom checker, knowledge, recommendations, analytics',
    };
  }

  protected registerServices(): void {
    this.controller = new AiController();
    this.diseaseController = new DiseaseIntelligenceController();

    this.registerService(getAiVeterinaryCoreService());
    this.registerService(getAiVeterinaryRepository());
    this.registerService(getAiSafetyService());
    this.registerService(getAiOrchestratorService());
    this.registerService(getAiUsageService());
    this.registerService(getAiFoundationService());
    this.registerService(getAiSettingsService());
    this.registerService(getAiSettingsRepository());
    this.registerService(getAiCostRateService());
    this.registerService(getAiProviderRepository());
    this.registerService(getAiModelRepository());
    this.registerService(getAiPlatformAuditService());
    this.registerService(getAiPromptService());
    this.registerService(getAiPromptManagementService());
    this.registerService(getAiAuditService());
    this.registerService(getAiKnowledgeService());
    this.registerService(getKnowledgeSourceRegistryService());
    this.registerService(getKnowledgeImportPipelineService());
    this.registerService(getKnowledgeEditorialWorkflowService());
    this.registerService(getKnowledgeVetApprovalWorkflowService());
    this.registerService(getKnowledgePublishWorkflowService());
    this.registerService(getKnowledgeRetrievalService());
    this.registerService(getKnowledgeEmbeddingPipelineService());
    this.registerService(getKnowledgeEmbeddingService());
    this.registerService(getSymptomCheckerService());
    this.registerService(getSmartRecommendationService());
    this.registerService(getNotificationIntelligenceService());
    this.registerService(getRiskScoringService());
    this.registerService(getFarmHealthService());
    this.registerService(getFollowUpService());
    this.registerService(getAiAssistantService());
    this.registerService(getVeterinaryAssistantService());
    this.registerService(getAiDoctorOrchestratorService());
    this.registerService(getDiseaseReasoningOrchestratorService());
    this.registerService(getAiPrescriptionOrchestratorService());
    this.registerService(getAiAnalyticsService());
    this.registerService(getAiUsageAnalyticsSummaryService());
    this.registerService(getAiCostAnalyticsService());
    this.registerService(getAiProviderAnalyticsService());
    this.registerService(getAiModelAnalyticsService());
    this.registerService(getAiPerformanceAnalyticsService());
    this.registerService(getAiMetricsAggregatorService());
    this.registerService(getKnowledgeFoundationService());
    this.registerService(getKnowledgeImportOrchestratorService());
    this.registerService(getKnowledgeChunkingOrchestratorService());
    this.registerService(getKnowledgeGovernanceOrchestratorService());
    this.registerService(getGraphSyncService());
    this.registerService(getAiRepository());
  }

  protected configureRoutes(): void {
    configureAiRoutes(this.router, this.controller);
    configureDiseaseIntelligenceRoutes(this.router, this.diseaseController);
    configureDiseaseVetRoutes(this.router, this.diseaseController);
  }
}

export class AiAdminModule extends BaseModule {
  private adminController!: AiAdminController;
  private diseaseAdminController!: DiseaseIntelligenceController;

  get metadata(): ModuleMetadata {
    return {
      name: 'internal-admin-ai-ops',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Internal break-glass admin AI ops (requires INTERNAL_ADMIN_AI_OPS_TOKEN)',
    };
  }

  protected registerServices(): void {
    this.adminController = new AiAdminController();
    this.diseaseAdminController = new DiseaseIntelligenceController();
    this.registerService(getKnowledgeFoundationService());
    this.registerService(getKnowledgeImportOrchestratorService());
    this.registerService(getKnowledgeChunkingOrchestratorService());
    this.registerService(getAiAnalyticsService());
    this.registerService(getAiKnowledgeService());
    this.registerService(getAiPromptService());
    this.registerService(getAiPromptManagementService());
    this.registerService(getAiAuditService());
    this.registerService(getAiOrchestratorService());
  }

  protected configureRoutes(): void {
    configureAiAdminRoutes(this.router, this.adminController);
    configureKnowledgeFoundationAdminRoutes(this.router);
    configureUvkgAdminRoutes(this.router);
    configureKnowledgeImportAdminRoutes(this.router);
    configureDiseaseIntelligenceAdminRoutes(this.router, this.diseaseAdminController);
  }
}

export function createAiModule(): AiModule {
  return new AiModule();
}

export function createAiAdminModule(): AiAdminModule {
  return new AiAdminModule();
}
