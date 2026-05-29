import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { getAiVeterinaryCoreService } from '../ai-veterinary-core/ai-veterinary-core.service.js';
import { getAiVeterinaryRepository } from '../ai-veterinary-core/repository/ai-veterinary.repository.js';
import { getAiSafetyService } from '../ai-veterinary-core/safety/ai-safety.service.js';

import { AiAdminController, AiController } from './ai.controller.js';
import { configureAiAdminRoutes, configureAiRoutes } from './ai.routes.js';
import { getAiAnalyticsService } from './analytics/ai-analytics.service.js';
import { getAiAssistantService } from './assistant/ai-assistant.service.js';
import { getAiAuditService } from './audit/ai-audit.service.js';
import { getFarmHealthService } from './farm-health/farm-health.service.js';
import { getFollowUpService } from './follow-up/follow-up.service.js';
import { getAiKnowledgeService } from './knowledge/ai-knowledge.service.js';
import { getNotificationIntelligenceService } from './notifications/notification-intelligence.service.js';
import { getAiOrchestratorService } from './orchestrator/ai-orchestrator.service.js';
import { getAiPromptService } from './prompts/ai-prompt.service.js';
import { getSmartRecommendationService } from './recommendations/smart-recommendation.service.js';
import { getRiskScoringService } from './risk/risk-scoring.service.js';
import { getSymptomCheckerService } from './symptom-checker/symptom-checker.service.js';
import { getAiUsageService } from './usage/ai-usage.service.js';
import { getAiRepository } from './ai.repository.js';

export class AiModule extends BaseModule {
  private controller!: AiController;

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

    this.registerService(getAiVeterinaryCoreService());
    this.registerService(getAiVeterinaryRepository());
    this.registerService(getAiSafetyService());
    this.registerService(getAiOrchestratorService());
    this.registerService(getAiUsageService());
    this.registerService(getAiPromptService());
    this.registerService(getAiAuditService());
    this.registerService(getAiKnowledgeService());
    this.registerService(getSymptomCheckerService());
    this.registerService(getSmartRecommendationService());
    this.registerService(getNotificationIntelligenceService());
    this.registerService(getRiskScoringService());
    this.registerService(getFarmHealthService());
    this.registerService(getFollowUpService());
    this.registerService(getAiAssistantService());
    this.registerService(getAiAnalyticsService());
    this.registerService(getAiRepository());
  }

  protected configureRoutes(): void {
    configureAiRoutes(this.router, this.controller);
  }
}

export class AiAdminModule extends BaseModule {
  private adminController!: AiAdminController;

  get metadata(): ModuleMetadata {
    return {
      name: 'admin-ai-ops',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Admin AI governance, knowledge, prompts, analytics',
    };
  }

  protected registerServices(): void {
    this.adminController = new AiAdminController();
    this.registerService(getAiAnalyticsService());
    this.registerService(getAiKnowledgeService());
    this.registerService(getAiPromptService());
    this.registerService(getAiAuditService());
    this.registerService(getAiOrchestratorService());
  }

  protected configureRoutes(): void {
    configureAiAdminRoutes(this.router, this.adminController);
  }
}

export function createAiModule(): AiModule {
  return new AiModule();
}

export function createAiAdminModule(): AiAdminModule {
  return new AiAdminModule();
}
