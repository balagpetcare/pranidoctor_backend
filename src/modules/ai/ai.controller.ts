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
import { getSymptomCheckerService } from './symptom-checker/symptom-checker.service.js';

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
  species: z.enum([
    'CATTLE',
    'BUFFALO',
    'GOAT',
    'SHEEP',
    'POULTRY',
    'DUCK',
    'PIGEON',
    'OTHER',
  ]),
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
    const species = z
      .enum(['CATTLE', 'BUFFALO', 'GOAT', 'SHEEP', 'POULTRY', 'DUCK', 'PIGEON', 'OTHER'])
      .parse(req.query.species);
    const result = await getSymptomCheckerService().getTaxonomy(species);
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

    const result = await getSymptomCheckerService().runCheck({
      userId: uid,
      customerId: cid ?? undefined,
      species: body.species,
      symptomCodes: body.symptomCodes,
      ...(body.freeTextSymptoms !== undefined ? { freeTextSymptoms: body.freeTextSymptoms } : {}),
      ...(body.livestockId !== undefined ? { livestockId: body.livestockId } : {}),
      ...(body.durationDays !== undefined ? { durationDays: body.durationDays } : {}),
      ...(body.severity !== undefined ? { severity: body.severity } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
      ...(body.aiSessionId !== undefined ? { aiSessionId: body.aiSessionId } : {}),
    });

    await getFollowUpService().createFromSymptomCheck({
      userId: uid,
      customerId: cid ?? undefined,
      livestockId: body.livestockId,
      sessionId: body.aiSessionId,
      triageBucket: result.triageBucket,
      locale: body.locale ?? 'bn',
    });

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
    sendSuccess(res, { items, disclaimer });
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
    sendSuccess(res, { ...result, disclaimer });
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

  async listPrompts(_req: Request, res: Response): Promise<void> {
    const { getAiPromptService } = await import('./prompts/ai-prompt.service.js');
    const result = await getAiPromptService().list();
    sendSuccess(res, result);
  }

  async createPrompt(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        key: z.string(),
        name: z.string(),
        systemBn: z.string(),
        systemEn: z.string(),
        description: z.string().optional(),
      })
      .parse(req.body);
    const { getAiPromptService } = await import('./prompts/ai-prompt.service.js');
    const result = await getAiPromptService().create(body);
    sendCreated(res, result);
  }

  async activatePrompt(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.id);
    const { getAiPromptService } = await import('./prompts/ai-prompt.service.js');
    const result = await getAiPromptService().activate(id);
    sendSuccess(res, result);
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
    const governance = await getAiGovernanceService().setLlmDisabled({
      llmDisabled: body.disable,
      reason: body.reason,
      source: 'internal_api',
      expectedVersion: body.expectedVersion,
    });
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
}
