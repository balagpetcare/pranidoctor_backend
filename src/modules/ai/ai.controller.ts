import type { Request, Response } from 'express';
import { z } from 'zod';

import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError } from '../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.js';
import { AiVeterinaryCoreController } from '../ai-veterinary-core/ai-veterinary-core.controller.js';

import { getAiAssistantService } from './assistant/ai-assistant.service.js';
import { getAiAnalyticsService } from './analytics/ai-analytics.service.js';
import { getAiKnowledgeService } from './knowledge/ai-knowledge.service.js';
import { getAiRepository } from './ai.repository.js';
import { getFarmHealthService } from './farm-health/farm-health.service.js';
import { getFollowUpService } from './follow-up/follow-up.service.js';
import { getNotificationIntelligenceService } from './notifications/notification-intelligence.service.js';
import { getSmartRecommendationService } from './recommendations/smart-recommendation.service.js';
import { resolveAiResponseDisclaimer } from './disclaimer/ai-disclaimer.resolver.js';
import { buildAiComplianceMetadata } from './compliance/ai-compliance.service.js';
import { getSymptomCheckerService } from './symptom-checker/symptom-checker.service.js';
import {
  API_LIVESTOCK_SPECIES,
  apiSpeciesToPrisma,
} from './symptom-checker/api-species.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { parseAnalyticsDateRange } from './analytics/usage/ai-usage-analytics.util.js';

function userId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required');
  }
  return req.user.id;
}

async function customerId(req: Request): Promise<string> {
  const cid = await getAiRepository().resolveCustomerId(userId(req));
  if (!cid) {
    throw new ValidationError('CUSTOMER_REQUIRED', 'Customer profile required');
  }
  return cid;
}

async function assertOwnedFarm(req: Request, farmRef: string): Promise<string> {
  const cid = await customerId(req);
  await getAiRepository().assertCustomerOwnedFarm(cid, farmRef);
  return cid;
}

const symptomCheckSchema = z.object({
  species: z.enum(API_LIVESTOCK_SPECIES),
  symptomCodes: z.array(z.string().min(1).max(64)).min(1).max(20),
  freeTextSymptoms: z.array(z.string().min(1).max(200)).max(5).optional(),
  livestockId: z.string().max(64).optional(),
  durationDays: z.number().int().min(0).max(365).optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).optional(),
  locale: z.enum(['bn', 'en']).optional(),
  aiSessionId: z.string().max(64).optional(),
});

export class AiController extends AiVeterinaryCoreController {
  async chatEnhanced(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        message: z.string().min(1).max(4000),
        sessionId: z.string().max(64).optional(),
        caseId: z.string().max(64).optional(),
        livestockId: z.string().max(64).optional(),
        locale: z.enum(['bn', 'en']).optional(),
      })
      .parse(req.body);

    const uid = userId(req);
    const cid = await getAiRepository().resolveCustomerId(uid);
    if (body.livestockId && cid) {
      const animal = await getAiRepository().assertCustomerOwnedLivestock(cid, body.livestockId);
      if (!animal) {
        throw new ForbiddenError('LIVESTOCK_ACCESS_DENIED', 'Livestock not accessible');
      }
    }

    const result = await getAiAssistantService().chat(uid, {
      message: body.message,
      ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
      ...(body.livestockId !== undefined ? { livestockId: body.livestockId } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    });
    sendCreated(res, result);
  }

  async symptomTaxonomy(req: Request, res: Response): Promise<void> {
    const species = z.enum(API_LIVESTOCK_SPECIES).parse(req.query.species);
    const result = await getSymptomCheckerService().getTaxonomy(apiSpeciesToPrisma(species));
    sendSuccess(res, result);
  }

  async symptomCheck(req: Request, res: Response): Promise<void> {
    const body = symptomCheckSchema.parse(req.body);
    const uid = userId(req);
    const cid = await getAiRepository().resolveCustomerId(uid);
    if (body.livestockId && cid) {
      const animal = await getAiRepository().assertCustomerOwnedLivestock(cid, body.livestockId);
      if (!animal) {
        throw new ForbiddenError('LIVESTOCK_ACCESS_DENIED', 'Livestock not accessible');
      }
    }

    const result = await getSymptomCheckerService().runCheck(
      omitUndefined({
        userId: uid,
        customerId: cid ?? undefined,
        species: apiSpeciesToPrisma(body.species),
        symptomCodes: body.symptomCodes,
        freeTextSymptoms: body.freeTextSymptoms,
        livestockId: body.livestockId,
        durationDays: body.durationDays,
        severity: body.severity,
        locale: body.locale,
        aiSessionId: body.aiSessionId,
      }),
    );

    await getFollowUpService().createFromSymptomCheck(
      omitUndefined({
        userId: uid,
        customerId: cid ?? undefined,
        livestockId: body.livestockId,
        sessionId: body.aiSessionId,
        triageBucket: result.triageBucket,
        locale: body.locale ?? 'bn',
      }),
    );

    sendCreated(res, result);
  }

  async knowledgeSearch(req: Request, res: Response): Promise<void> {
    const q = z
      .object({
        q: z.string().min(1).max(200),
        locale: z.enum(['bn', 'en']).optional(),
        species: z.string().max(32).optional(),
      })
      .parse(req.query);

    const result = await getAiKnowledgeService().search({
      query: q.q,
      locale: q.locale ?? 'bn',
      ...(q.species ? { species: q.species as never } : {}),
    });
    sendSuccess(res, result);
  }

  async knowledgeGet(req: Request, res: Response): Promise<void> {
    const slug = z.string().parse(req.params.slug);
    const locale = z.enum(['bn', 'en']).optional().parse(req.query.locale) ?? 'bn';
    const result = await getAiKnowledgeService().getBySlug(slug, locale);
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } });
      return;
    }
    sendSuccess(res, result);
  }

  async smartRecommendations(req: Request, res: Response): Promise<void> {
    const cid = await customerId(req);
    const farmRef = typeof req.query.farmRef === 'string' ? req.query.farmRef : undefined;
    if (farmRef) {
      await getAiRepository().assertCustomerOwnedFarm(cid, farmRef);
    }
    const locale = req.query.locale === 'en' ? 'en' : 'bn';
    const items = await getSmartRecommendationService().generateForCustomer(cid, farmRef, locale);
    const disclaimer = await resolveAiResponseDisclaimer('recommendations', locale);
    const compliance = await buildAiComplianceMetadata({
      feature: 'recommendations',
      riskLevel: 'LOW',
      emergency: false,
      escalationRequired: false,
    });
    sendSuccess(res, { items, disclaimer, compliance });
  }

  async dismissRecommendation(req: Request, res: Response): Promise<void> {
    const cid = await customerId(req);
    const id = z.string().parse(req.params.id);
    const updated = await getSmartRecommendationService().dismiss(cid, id);
    if (!updated) {
      throw new NotFoundError('RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
    }
    sendSuccess(res, { ok: true });
  }

  async completeRecommendation(req: Request, res: Response): Promise<void> {
    const cid = await customerId(req);
    const id = z.string().parse(req.params.id);
    const updated = await getSmartRecommendationService().complete(cid, id);
    if (!updated) {
      throw new NotFoundError('RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
    }
    sendSuccess(res, { ok: true });
  }

  async smartAlerts(req: Request, res: Response): Promise<void> {
    const cid = await customerId(req);
    const locale = req.query.locale === 'en' ? 'en' : 'bn';
    await getNotificationIntelligenceService().syncAlertsFromRecommendations(cid, userId(req));
    const result = await getNotificationIntelligenceService().listAlerts(cid, locale);
    sendSuccess(res, result);
  }

  async dismissAlert(req: Request, res: Response): Promise<void> {
    const cid = await customerId(req);
    const id = z.string().parse(req.params.id);
    await getNotificationIntelligenceService().dismissAlert(cid, id);
    sendSuccess(res, { ok: true });
  }

  async farmHealthDashboard(req: Request, res: Response): Promise<void> {
    const farmRef = z.string().min(1).max(200).parse(req.query.farmRef);
    const cid = await assertOwnedFarm(req, farmRef);
    const locale = req.query.locale === 'en' ? 'en' : 'bn';
    const result = await getFarmHealthService().getDashboard(cid, farmRef, locale);
    const disclaimer = await resolveAiResponseDisclaimer('advisory', locale);
    const compliance = await buildAiComplianceMetadata({
      feature: 'farm_health',
      riskLevel:
        result.farmRiskScore >= 70 ? 'HIGH' : result.farmRiskScore >= 40 ? 'MEDIUM' : 'LOW',
      emergency: false,
      escalationRequired: result.farmRiskScore >= 70,
    });
    sendSuccess(res, { ...result, disclaimer, compliance });
  }

  async farmBriefing(req: Request, res: Response): Promise<void> {
    const farmRef = z.string().min(1).max(200).parse(req.body.farmRef);
    await assertOwnedFarm(req, farmRef);
    const locale = z.enum(['bn', 'en']).optional().parse(req.body.locale) ?? 'bn';
    const result = await getAiAssistantService().farmBriefing(userId(req), farmRef, locale);
    sendCreated(res, result);
  }

  async farmQuery(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        query: z.string().min(1).max(2000),
        farmRef: z.string().min(1).max(200),
        locale: z.enum(['bn', 'en']).optional(),
      })
      .parse(req.body);
    await assertOwnedFarm(req, body.farmRef);
    const result = await getAiAssistantService().farmQuery(
      userId(req),
      body.query,
      body.farmRef,
      body.locale ?? 'bn',
    );
    sendCreated(res, result);
  }

  async followUps(req: Request, res: Response): Promise<void> {
    const locale = req.query.locale === 'en' ? 'en' : 'bn';
    const result = await getFollowUpService().listForUser(userId(req), locale);
    sendSuccess(res, result);
  }

  async dismissFollowUp(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    await getFollowUpService().dismiss(userId(req), id);
    sendSuccess(res, { ok: true });
  }

  async mobileAnalytics(req: Request, res: Response): Promise<void> {
    const farmRef = z.string().min(1).max(200).parse(req.query.farmRef);
    const cid = await assertOwnedFarm(req, farmRef);
    const { getRiskScoringService } = await import('./risk/risk-scoring.service.js');
    const result = await getRiskScoringService().computeFarmRisk(cid, farmRef);
    sendSuccess(res, result);
  }
}

export class AiAdminController {
  async overview(_req: Request, res: Response): Promise<void> {
    const result = await getAiAnalyticsService().getOverview(30);
    sendSuccess(res, result);
  }

  async riskMonitoring(_req: Request, res: Response): Promise<void> {
    const result = await getAiAnalyticsService().getRiskMonitoring();
    sendSuccess(res, result);
  }

  async listKnowledge(_req: Request, res: Response): Promise<void> {
    const result = await getAiKnowledgeService().listAdmin();
    sendSuccess(res, result);
  }

  async createKnowledge(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        contentType: z.enum(['DISEASE', 'MEDICINE', 'VACCINE', 'FEED', 'FARM_MGMT', 'EMERGENCY']),
        slug: z.string(),
        titleBn: z.string(),
        titleEn: z.string(),
        bodyBn: z.string(),
        bodyEn: z.string(),
        species: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const result = await getAiKnowledgeService().create({
      contentType: body.contentType,
      slug: body.slug,
      titleBn: body.titleBn,
      titleEn: body.titleEn,
      bodyBn: body.bodyBn,
      bodyEn: body.bodyEn,
      ...(body.species ? { species: body.species as never } : {}),
    });
    sendCreated(res, result);
  }

  async publishKnowledge(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const result = await getAiKnowledgeService().publish(id);
    sendSuccess(res, result);
  }

  async listPrompts(req: Request, res: Response): Promise<void> {
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const { AiPromptStatus } = await import('../../generated/prisma/index.js');
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const status =
      statusRaw && (Object.values(AiPromptStatus) as string[]).includes(statusRaw)
        ? (statusRaw as (typeof AiPromptStatus)[keyof typeof AiPromptStatus])
        : undefined;

    const result = await getAiPromptManagementService().list(
      omitUndefined({
        kind: req.query.kind === 'system' || req.query.kind === 'feature' ? req.query.kind : undefined,
        taskType: typeof req.query.taskType === 'string' ? req.query.taskType : undefined,
        promptKey: typeof req.query.promptKey === 'string' ? req.query.promptKey : undefined,
        status,
        includeArchived: req.query.includeArchived === 'true',
      }),
    );
    sendSuccess(res, result);
  }

  async getPrompt(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().getById(id);
    sendSuccess(res, result);
  }

  async listPromptVersions(req: Request, res: Response): Promise<void> {
    const promptKey = z.string().parse(req.params.promptKey);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().listVersions(promptKey);
    sendSuccess(res, result);
  }

  async createPrompt(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        key: z.string().min(1).max(64),
        promptKey: z.string().min(1).max(64).optional(),
        name: z.string().min(1).max(128),
        description: z.string().max(500).optional(),
        kind: z.enum(['system', 'feature']).optional(),
        taskType: z.string().max(64).optional(),
        systemBn: z.string().min(1),
        systemEn: z.string().min(1),
        userTemplateBn: z.string().optional(),
        userTemplateEn: z.string().optional(),
        trafficPercent: z.number().int().min(0).max(100).optional(),
      })
      .parse(req.body);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().createDraft(
      omitUndefined({
        promptKey: body.promptKey ?? body.key,
        name: body.name,
        description: body.description,
        kind: body.kind,
        taskType: body.taskType,
        systemBn: body.systemBn,
        systemEn: body.systemEn,
        userTemplateBn: body.userTemplateBn,
        userTemplateEn: body.userTemplateEn,
        trafficPercent: body.trafficPercent,
        actor: adminActorFromRequest(req),
      }),
    );
    sendCreated(res, result);
  }

  async createPromptDraftFromPublished(req: Request, res: Response): Promise<void> {
    const promptKey = z.string().parse(req.params.promptKey);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().createDraftFromPublished(promptKey, {
      actor: adminActorFromRequest(req),
    });
    sendCreated(res, result);
  }

  async updatePrompt(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const body = z
      .object({
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(500).nullable().optional(),
        taskType: z.string().max(64).nullable().optional(),
        systemBn: z.string().min(1).optional(),
        systemEn: z.string().min(1).optional(),
        userTemplateBn: z.string().nullable().optional(),
        userTemplateEn: z.string().nullable().optional(),
        trafficPercent: z.number().int().min(0).max(100).optional(),
      })
      .parse(req.body);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().updateDraft(
      id,
      omitUndefined({ ...body, actor: adminActorFromRequest(req) }),
    );
    sendSuccess(res, result);
  }

  async publishPrompt(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().publish(id, adminActorFromRequest(req));
    sendSuccess(res, result);
  }

  async rollbackPrompt(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    const result = await getAiPromptManagementService().rollback(id, adminActorFromRequest(req));
    sendSuccess(res, result);
  }

  async deletePromptDraft(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiPromptManagementService } = await import('./prompts/management/ai-prompt-management.service.js');
    await getAiPromptManagementService().softDeleteDraft(id, adminActorFromRequest(req));
    sendSuccess(res, { deleted: true, id });
  }

  async activatePrompt(req: Request, res: Response): Promise<void> {
    await this.publishPrompt(req, res);
  }

  async listEscalations(_req: Request, res: Response): Promise<void> {
    const { getAiAuditService } = await import('./audit/ai-audit.service.js');
    const result = await getAiAuditService().listEscalations();
    sendSuccess(res, result);
  }

  async auditLog(req: Request, res: Response): Promise<void> {
    const { getAiAuditService } = await import('./audit/ai-audit.service.js');
    const sinceDays = Math.min(90, Math.max(1, Number(req.query.sinceDays ?? 7)));
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const result = await getAiAuditService().search({ since, limit: 100 });
    sendSuccess(res, result);
  }

  async killSwitch(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        disable: z.boolean(),
        reason: z.string().optional(),
        expectedVersion: z.number().int().positive().optional(),
      })
      .parse(req.body);
    const { getAiGovernanceService } = await import('./governance/ai-governance.service.js');
    const governance = await getAiGovernanceService().setLlmDisabled(
      omitUndefined({
        llmDisabled: body.disable,
        reason: body.reason,
        source: 'internal_api' as const,
        expectedVersion: body.expectedVersion,
      }),
    );
    sendSuccess(res, {
      llmDisabled: governance.llmDisabled,
      version: governance.version,
      governance,
    });
  }

  async userTokenUsage(req: Request, res: Response): Promise<void> {
    const userId = z.string().parse(req.params.userId);
    const sinceDays = Math.min(90, Math.max(1, Number(req.query.sinceDays ?? 30)));
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const { getAiUsageService } = await import('./usage/ai-usage.service.js');
    const result = await getAiUsageService().getUserConsumption(userId, since);
    sendSuccess(res, result);
  }

  async customerTokenUsage(req: Request, res: Response): Promise<void> {
    const customerId = z.string().parse(req.params.customerId);
    const sinceDays = Math.min(90, Math.max(1, Number(req.query.sinceDays ?? 30)));
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const { getAiUsageService } = await import('./usage/ai-usage.service.js');
    const result = await getAiUsageService().getCustomerConsumption(customerId, since);
    sendSuccess(res, result);
  }

  async usageAnalyticsDashboard(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const { getAiUsageAnalyticsService } = await import('./analytics/usage/ai-usage-analytics.service.js');
    const result = await getAiUsageAnalyticsService().getDashboard(filters);
    sendSuccess(res, result);
  }

  async usageDailyCost(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const { getAiUsageAnalyticsService } = await import('./analytics/usage/ai-usage-analytics.service.js');
    const result = await getAiUsageAnalyticsService().getDailyCost(filters);
    sendSuccess(res, { range: filters, dailyCost: result });
  }

  async usageMonthlyCost(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const { getAiUsageAnalyticsService } = await import('./analytics/usage/ai-usage-analytics.service.js');
    const result = await getAiUsageAnalyticsService().getMonthlyCost(filters);
    sendSuccess(res, { range: filters, monthlyCost: result });
  }

  async usageProviderComparison(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const { getAiUsageAnalyticsService } = await import('./analytics/usage/ai-usage-analytics.service.js');
    const result = await getAiUsageAnalyticsService().getProviderComparison(filters);
    sendSuccess(res, { range: filters, providers: result });
  }

  async usageFeatureComparison(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const { getAiUsageAnalyticsService } = await import('./analytics/usage/ai-usage-analytics.service.js');
    const result = await getAiUsageAnalyticsService().getFeatureComparison(filters);
    sendSuccess(res, { range: filters, features: result });
  }

  async usageCostTrends(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const granularity = req.query.granularity === 'week' ? 'week' : 'day';
    const { getAiUsageAnalyticsService } = await import('./analytics/usage/ai-usage-analytics.service.js');
    const result = await getAiUsageAnalyticsService().getCostTrends(filters, granularity);
    sendSuccess(res, { range: filters, granularity, trends: result });
  }

  async usageReport(req: Request, res: Response): Promise<void> {
    const filters = parseUsageAnalyticsQuery(req);
    const format = String(req.query.format ?? 'json').toLowerCase();
    const limit = Math.min(10_000, Math.max(1, Number(req.query.limit ?? 5000)));

    if (format === 'csv') {
      const { getAiUsageReportService } = await import('./analytics/usage/ai-usage-report.service.js');
      const csv = await getAiUsageReportService().generateCsv(filters, { limit });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ai-usage-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.status(200).send(csv);
      return;
    }

    const { getAiUsageReportService } = await import('./analytics/usage/ai-usage-report.service.js');
    const result = await getAiUsageReportService().generateReport(filters, { limit });
    sendSuccess(res, result);
  }

  async listSecrets(_req: Request, res: Response): Promise<void> {
    const { getAiSecretService } = await import('./vault/ai-secret.service.js');
    const result = await getAiSecretService().listKeys();
    sendSuccess(res, result);
  }

  async addSecret(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        providerKey: z.string().min(1).max(32),
        name: z.string().min(1).max(128),
        secret: z.string().min(20),
        expiresAt: z.string().datetime().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const { getAiSecretService } = await import('./vault/ai-secret.service.js');
    const result = await getAiSecretService().addKey(
      omitUndefined({
        providerKey: body.providerKey,
        name: body.name,
        secret: body.secret,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        reason: body.reason,
        actor: adminActorFromRequest(req),
      }),
    );
    sendCreated(res, result);
  }

  async updateSecret(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const body = z
      .object({
        name: z.string().min(1).max(128).optional(),
        secret: z.string().min(20).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const { getAiSecretService } = await import('./vault/ai-secret.service.js');
    const result = await getAiSecretService().updateKey(
      id,
      omitUndefined({
        name: body.name,
        secret: body.secret,
        expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
        reason: body.reason,
        actor: adminActorFromRequest(req),
      }),
    );
    sendSuccess(res, result);
  }

  async disableSecret(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const body = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});
    const { getAiSecretService } = await import('./vault/ai-secret.service.js');
    const result = await getAiSecretService().disableKey(id, adminActorFromRequest(req), body.reason);
    sendSuccess(res, result);
  }

  async testSecret(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiSecretService } = await import('./vault/ai-secret.service.js');
    const result = await getAiSecretService().testKey(id, adminActorFromRequest(req));
    sendSuccess(res, result);
  }

  async rotateSecret(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const body = z
      .object({
        secret: z.string().min(20),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const { getKeyRotationService } = await import('./vault/key-rotation.service.js');
    const result = await getKeyRotationService().rotateKey(
      id,
      body.secret,
      adminActorFromRequest(req),
      body.reason,
    );
    sendSuccess(res, result);
  }

  async listSecretAudit(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiSecretService } = await import('./vault/ai-secret.service.js');
    const result = await getAiSecretService().listAuditLog(id);
    sendSuccess(res, result);
  }
}

function adminActorFromRequest(req: Request): { userId?: string; role?: string; ipAddress?: string } {
  const user = req.user as { id?: string; role?: string } | undefined;
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]
        : req.ip;
  return omitUndefined({
    userId: user?.id,
    role: user?.role,
    ipAddress: ip,
  });
}

function parseUsageAnalyticsQuery(req: Request) {
  const rangeInput: { from?: string; to?: string; sinceDays?: number } = {};
  if (typeof req.query.from === 'string') rangeInput.from = req.query.from;
  if (typeof req.query.to === 'string') rangeInput.to = req.query.to;
  if (req.query.sinceDays != null) rangeInput.sinceDays = Number(req.query.sinceDays);

  const { from, to } = parseAnalyticsDateRange(rangeInput);

  return omitUndefined({
    from,
    to,
    branchId: typeof req.query.branchId === 'string' ? req.query.branchId : undefined,
    organizationId:
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined,
    tenantId: typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
    userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
    feature: typeof req.query.feature === 'string' ? req.query.feature : undefined,
    provider: typeof req.query.provider === 'string' ? req.query.provider : undefined,
    taskType: typeof req.query.taskType === 'string' ? req.query.taskType : undefined,
  });
}
