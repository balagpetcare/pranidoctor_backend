import type { Request, Response } from 'express';
import { z } from 'zod';

import { ForbiddenError } from '../../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../../shared/utils/response.js';
import { requireInternalAdminAiOps } from '../ai-admin.middleware.js';
import { getKnowledgeFoundationService } from './knowledge-foundation.service.js';
import { getKnowledgeGovernanceOrchestratorService } from '../knowledge-governance/index.js';
import { knowledgeFoundationCan } from './permissions/knowledge-foundation.permissions.js';
import type { FoundationActor } from './knowledge-foundation.types.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

function foundationActor(req: Request): FoundationActor {
  const actorId =
    typeof req.headers['x-admin-user-id'] === 'string' ? req.headers['x-admin-user-id'] : 'internal-admin';
  const role =
    typeof req.headers['x-admin-role'] === 'string' ? req.headers['x-admin-role'] : 'INTERNAL';
  return { id: actorId, role };
}

function assertCap(req: Request, cap: Parameters<typeof knowledgeFoundationCan>[1]): void {
  const actor = foundationActor(req);
  if (!knowledgeFoundationCan(actor, cap)) {
    throw new ForbiddenError('FORBIDDEN', `Missing capability: ${cap}`);
  }
}

export class KnowledgeFoundationController {
  async listSources(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.view');
    const result = await getKnowledgeFoundationService().listSources();
    sendSuccess(res, { sources: result });
  }

  async createSource(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.sources.manage');
    const body = z
      .object({
        sourceKey: z.string().min(1).max(128),
        sourceClass: z.string(),
        sourceType: z.string(),
        titleBn: z.string().min(1),
        titleEn: z.string().min(1),
        publisher: z.string().optional(),
        publishYear: z.number().int().optional(),
        edition: z.string().optional(),
        jurisdiction: z.string().optional(),
        trustTier: z.number().int().min(1).max(4).optional(),
        licenseId: z.string().optional(),
      })
      .parse(req.body);

    const result = await getKnowledgeFoundationService().createSource(
      omitUndefined({
        sourceKey: body.sourceKey,
        sourceClass: body.sourceClass as never,
        sourceType: body.sourceType as never,
        titleBn: body.titleBn,
        titleEn: body.titleEn,
        publisher: body.publisher,
        publishYear: body.publishYear,
        edition: body.edition,
        jurisdiction: body.jurisdiction,
        trustTier: body.trustTier,
        licenseId: body.licenseId,
      }),
      foundationActor(req),
    );
    sendCreated(res, result);
  }

  async listEntities(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.view');
    const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
    const result = await getKnowledgeFoundationService().listEntities(domain);
    sendSuccess(res, { entities: result });
  }

  async getEntity(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.view');
    const id = z.string().parse(req.params.id);
    const result = await getKnowledgeFoundationService().getEntity(id);
    sendSuccess(res, result);
  }

  async createEntity(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.edit');
    const body = z
      .object({
        domain: z.string(),
        entityType: z.string().min(1).max(64),
        slug: z.string().min(1).max(128),
        titleBn: z.string().min(1),
        titleEn: z.string().min(1),
        bodyBn: z.string().min(1),
        bodyEn: z.string().min(1),
        summaryBn: z.string().optional(),
        summaryEn: z.string().optional(),
        species: z.array(z.string()).optional(),
        audience: z.enum(['FARMER', 'DOCTOR', 'BOTH']).optional(),
        regionScope: z.string().optional(),
        clinicalRiskTier: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        legacyEntryId: z.string().optional(),
      })
      .parse(req.body);

    const result = await getKnowledgeFoundationService().createEntity(
      omitUndefined({
        domain: body.domain as never,
        entityType: body.entityType,
        slug: body.slug,
        titleBn: body.titleBn,
        titleEn: body.titleEn,
        bodyBn: body.bodyBn,
        bodyEn: body.bodyEn,
        summaryBn: body.summaryBn,
        summaryEn: body.summaryEn,
        species: body.species as never,
        audience: body.audience,
        regionScope: body.regionScope,
        clinicalRiskTier: body.clinicalRiskTier,
        legacyEntryId: body.legacyEntryId,
      }),
      foundationActor(req),
    );
    sendCreated(res, result);
  }

  async getVersion(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.view');
    const id = z.string().parse(req.params.versionId);
    const result = await getKnowledgeFoundationService().getVersion(id);
    sendSuccess(res, result);
  }

  async updateVersion(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.edit');
    const id = z.string().parse(req.params.versionId);
    const body = z
      .object({
        titleBn: z.string().optional(),
        titleEn: z.string().optional(),
        summaryBn: z.string().optional(),
        summaryEn: z.string().optional(),
        bodyBn: z.string().optional(),
        bodyEn: z.string().optional(),
        species: z.array(z.string()).optional(),
        audience: z.enum(['FARMER', 'DOCTOR', 'BOTH']).optional(),
        regionScope: z.string().optional(),
        clinicalRiskTier: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        changeSummary: z.string().optional(),
      })
      .parse(req.body);

    const result = await getKnowledgeFoundationService().updateVersionDraft(
      id,
      omitUndefined({ ...body, species: body.species as never }),
      foundationActor(req),
    );
    sendSuccess(res, result);
  }

  async submitVersion(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.edit');
    const id = z.string().parse(req.params.versionId);
    const result = await getKnowledgeGovernanceOrchestratorService().submitForReview(
      { versionId: id },
      foundationActor(req),
    );
    sendSuccess(res, result);
  }

  async forkVersion(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.edit');
    const id = z.string().parse(req.params.versionId);
    const result = await getKnowledgeFoundationService().forkVersion(id, foundationActor(req));
    sendCreated(res, result);
  }

  async listCitations(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.view');
    const id = z.string().parse(req.params.versionId);
    const result = await getKnowledgeFoundationService().listCitations(id);
    sendSuccess(res, { citations: result });
  }

  async addCitation(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.edit');
    const versionId = z.string().parse(req.params.versionId);
    const body = z
      .object({
        sourceId: z.string(),
        documentId: z.string().optional(),
        pageRef: z.string().optional(),
        sectionRef: z.string().optional(),
        tableRef: z.string().optional(),
        rowRef: z.string().optional(),
        contributionWeight: z.number().optional(),
        quotedFrom: z.boolean().optional(),
        inlineCitationKey: z.string().optional(),
        humanCitationBn: z.string().optional(),
        humanCitationEn: z.string().optional(),
      })
      .parse(req.body);

    const result = await getKnowledgeFoundationService().addCitation(
      versionId,
      omitUndefined(body),
      foundationActor(req),
    );
    sendCreated(res, result);
  }

  async removeCitation(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.edit');
    const citationId = z.string().parse(req.params.citationId);
    await getKnowledgeFoundationService().removeCitation(citationId, foundationActor(req));
    sendSuccess(res, { removed: true });
  }

  async editorialQueue(_req: Request, res: Response): Promise<void> {
    assertCap(_req, 'ai.knowledge.review');
    const result = await getKnowledgeGovernanceOrchestratorService().listReviewQueue();
    sendSuccess(res, { queue: result });
  }

  async completeReview(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.review');
    const body = z
      .object({
        reviewId: z.string(),
        decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']),
        reviewerId: z.string(),
        comments: z.string().optional(),
        changeRequest: z
          .object({
            summaryBn: z.string().optional(),
            summaryEn: z.string().optional(),
            severity: z.enum(['MINOR', 'MAJOR', 'BLOCKING']).optional(),
          })
          .optional(),
      })
      .parse(req.body);

    const result = await getKnowledgeGovernanceOrchestratorService().completeReview(
      {
        reviewId: body.reviewId,
        decision: body.decision,
        reviewerId: body.reviewerId,
        ...(body.comments !== undefined ? { comments: body.comments } : {}),
        ...(body.changeRequest !== undefined ? { changeRequest: body.changeRequest } : {}),
      },
      foundationActor(req),
    );
    sendSuccess(res, result);
  }

  async vetQueue(_req: Request, res: Response): Promise<void> {
    assertCap(_req, 'ai.knowledge.approve');
    const result = await getKnowledgeGovernanceOrchestratorService().listVetQueue();
    sendSuccess(res, { queue: result });
  }

  async recordApproval(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.approve');
    const body = z
      .object({
        versionId: z.string(),
        approverVetId: z.string(),
        vetLicenseNo: z.string().min(1),
        approvalScope: z.array(z.string()).min(1),
        validUntil: z.string().datetime().optional(),
        dualApprovalRequired: z.boolean().optional(),
        coApproverVetId: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const result = await getKnowledgeGovernanceOrchestratorService().recordVetApproval(
      omitUndefined({
        versionId: body.versionId,
        approverVetId: body.approverVetId,
        vetLicenseNo: body.vetLicenseNo,
        approvalScope: body.approvalScope,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        dualApprovalRequired: body.dualApprovalRequired,
        coApproverVetId: body.coApproverVetId,
        notes: body.notes,
      }),
      foundationActor(req),
    );
    sendSuccess(res, result);
  }

  async publishVersion(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.publish');
    const id = z.string().parse(req.params.versionId);
    const body = z
      .object({ overrideReason: z.string().optional() })
      .optional()
      .parse(req.body ?? {});

    const result = await getKnowledgeGovernanceOrchestratorService().publish(
      omitUndefined({ versionId: id, overrideReason: body?.overrideReason }),
      foundationActor(req),
    );
    sendSuccess(res, result);
  }

  async archiveVersion(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.versionId);
    const body = z
      .object({
        reason: z.string().min(1),
        archiveType: z.enum(['REJECT', 'DEPRECATE', 'EMERGENCY_UNPUBLISH']),
      })
      .parse(req.body);

    if (body.archiveType === 'EMERGENCY_UNPUBLISH') {
      const actor = foundationActor(req);
      if (actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('FORBIDDEN', 'Emergency unpublish requires SUPER_ADMIN');
      }
    } else {
      assertCap(req, 'ai.knowledge.publish');
    }

    const result = await getKnowledgeGovernanceOrchestratorService().archive(
      { versionId: id, reason: body.reason, archiveType: body.archiveType },
      foundationActor(req),
    );
    sendSuccess(res, result);
  }

  async governanceStage(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.view');
    const id = z.string().parse(req.params.versionId);
    const stage = await getKnowledgeGovernanceOrchestratorService().getGovernanceStage(id);
    sendSuccess(res, { versionId: id, stage });
  }

  async approvalQueue(_req: Request, res: Response): Promise<void> {
    assertCap(_req, 'ai.knowledge.publish');
    const result = await getKnowledgeGovernanceOrchestratorService().listApprovalQueue();
    sendSuccess(res, { queue: result });
  }

  async listAudit(req: Request, res: Response): Promise<void> {
    assertCap(req, 'ai.knowledge.audit.export');
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
    const result = await getKnowledgeFoundationService().listAudit(limit);
    sendSuccess(res, { events: result });
  }
}

let controller: KnowledgeFoundationController | null = null;

export function getKnowledgeFoundationController(): KnowledgeFoundationController {
  if (!controller) controller = new KnowledgeFoundationController();
  return controller;
}

export const knowledgeFoundationAdminGuard = requireInternalAdminAiOps;
