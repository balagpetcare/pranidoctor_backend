import type { Request, Response } from 'express';
import { z } from 'zod';

import type { DiDiseaseCategory } from '../../../generated/prisma/index.js';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../../shared/utils/response.js';
import { getAiRepository } from '../ai.repository.js';
import {
  API_LIVESTOCK_SPECIES,
  apiSpeciesToPrisma,
} from '../symptom-checker/api-species.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

function userId(req: Request): string {
  if (!req.user?.id) throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required');
  return req.user.id;
}
import { getDiseaseRegistryService } from './registry/disease-registry.service.js';
import { getDiseaseGraphService } from './graph/disease-graph.service.js';
import { getSymptomTaxonomyService } from './symptom/symptom-taxonomy.service.js';
import { getDifferentialDiagnosisService } from './differential/differential-diagnosis.service.js';
import { getOutbreakIntelligenceService } from './outbreak/outbreak-intelligence.service.js';
import { getClinicalSafetyEngine } from './safety/clinical-safety.engine.js';
import { getDiseaseAnalyticsService } from './analytics/disease-analytics.service.js';
import { getVetAssistService } from './vet-assist/vet-assist.service.js';
import { getDiseaseReasoningOrchestratorService } from './reasoning/disease-reasoning-orchestrator.service.js';

const speciesSchema = z.enum(API_LIVESTOCK_SPECIES);

export class DiseaseIntelligenceController {
  async searchRegistry(req: Request, res: Response): Promise<void> {
    const q = z.string().optional().parse(req.query.q);
    const speciesRaw = req.query.species
      ? speciesSchema.parse(req.query.species)
      : undefined;
    const rows = await getDiseaseRegistryService().search(
      omitUndefined({
        q,
        ...(speciesRaw ? { species: apiSpeciesToPrisma(speciesRaw) } : {}),
      }),
    );
    sendSuccess(res, { diseases: rows });
  }

  async getRegistry(req: Request, res: Response): Promise<void> {
    const code = z.string().parse(req.params.code);
    const row = await getDiseaseRegistryService().getByCode(code);
    sendSuccess(res, { disease: row });
  }

  async graphNeighbors(req: Request, res: Response): Promise<void> {
    const nodeRef = z.string().parse(req.query.nodeRef);
    const nodeKind = z.enum(['DISEASE', 'SYMPTOM']).parse(req.query.nodeKind ?? 'DISEASE');
    const speciesRaw = req.query.species ? speciesSchema.parse(req.query.species) : undefined;
    const neighbors = await getDiseaseGraphService().getNeighbors(
      omitUndefined({
        nodeRef,
        nodeKind,
        ...(speciesRaw ? { species: apiSpeciesToPrisma(speciesRaw) } : {}),
      }),
    );
    sendSuccess(res, { neighbors });
  }

  async symptomTaxonomy(req: Request, res: Response): Promise<void> {
    const species = apiSpeciesToPrisma(speciesSchema.parse(req.query.species ?? 'COW'));
    const dieTaxonomy = await getSymptomTaxonomyService().getTaxonomy(species);
    sendSuccess(res, dieTaxonomy ?? { species, source: 'legacy', bodySystems: [] });
  }

  async resolveSymptoms(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        phrases: z.array(z.string()).min(1),
        locale: z.enum(['bn', 'en']).default('bn'),
        species: speciesSchema,
      })
      .parse(req.body);
    const result = await getSymptomTaxonomyService().resolveText({
      phrases: body.phrases,
      locale: body.locale,
      species: apiSpeciesToPrisma(body.species),
    });
    sendSuccess(res, result);
  }

  async computeDifferential(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        symptomCodes: z.array(z.string()).min(1),
        species: speciesSchema,
        locale: z.enum(['bn', 'en']).default('bn'),
        divisionId: z.string().optional(),
        persona: z.enum(['farmer', 'paravet', 'vet']).optional(),
      })
      .parse(req.body);
    const result = await getDifferentialDiagnosisService().compute(
      omitUndefined({
        symptomCodes: body.symptomCodes,
        species: apiSpeciesToPrisma(body.species),
        locale: body.locale,
        divisionId: body.divisionId,
        persona: body.persona,
      }),
    );
    sendSuccess(res, result);
  }

  async evaluateSafety(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        queryText: z.string().min(1),
        locale: z.enum(['bn', 'en']).default('bn'),
        caseId: z.string().optional(),
      })
      .parse(req.body);
    const decision = await getClinicalSafetyEngine().evaluate(
      omitUndefined({
        queryText: body.queryText,
        locale: body.locale,
        caseId: body.caseId,
      }),
    );
    sendSuccess(res, { decision });
  }

  async outbreakMap(req: Request, res: Response): Promise<void> {
    const divisionId = z.string().optional().parse(req.query.divisionId);
    const signals = await getOutbreakIntelligenceService().listSignals(
      omitUndefined({ divisionId }),
    );
    sendSuccess(res, {
      signals: signals.map((s) => ({
        diseaseSlug: s.diseaseSlug,
        riskIndex: s.riskIndex,
        divisionId: s.divisionId,
        effectiveDate: s.effectiveDate,
      })),
    });
  }

  async subscribeOutbreak(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        species: z.array(speciesSchema).min(1),
        divisionId: z.string().optional(),
        channels: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const uid = userId(req);
    const cid = await getAiRepository().resolveCustomerId(uid);
    const sub = await getOutbreakIntelligenceService().subscribe(
      omitUndefined({
        userId: uid,
        ...(cid ? { customerId: cid } : {}),
        species: body.species.map((s) => apiSpeciesToPrisma(s)),
        divisionId: body.divisionId,
        channels: body.channels,
      }),
    );
    sendCreated(res, { subscription: sub });
  }

  async vetQueue(req: Request, res: Response): Promise<void> {
    const vetId = userId(req);
    const queue = await getVetAssistService().getQueue(vetId);
    sendSuccess(res, { queue });
  }

  async vetValidate(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        reviewId: z.string(),
        vetId: z.string().optional(),
        overrides: z.array(
          z.object({
            slug: z.string(),
            rank: z.number().int().positive(),
            registryId: z.string().optional(),
            notes: z.string().optional(),
          }),
        ),
      })
      .parse(req.body);
    const sessionVetId = userId(req);
    if (body.vetId && body.vetId !== sessionVetId) {
      throw new ForbiddenError('VET_ID_MISMATCH', 'vetId must match authenticated user');
    }
    const review = await getVetAssistService().validateDifferential({
      reviewId: body.reviewId,
      vetId: sessionVetId,
      overrides: body.overrides.map((o) =>
        omitUndefined({
          slug: o.slug,
          rank: o.rank,
          registryId: o.registryId,
          notes: o.notes,
        }),
      ),
    });
    sendSuccess(res, { review });
  }

  async adminAnalyticsOverview(_req: Request, res: Response): Promise<void> {
    const overview = await getDiseaseAnalyticsService().getOverview();
    sendSuccess(res, overview);
  }

  async adminCreateRegistry(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        code: z.string().min(2).max(32),
        slug: z.string().min(2).max(128),
        labelBn: z.string().min(1),
        labelEn: z.string().min(1),
        category: z.string(),
        species: z.array(speciesSchema).optional(),
      })
      .parse(req.body);
    const row = await getDiseaseRegistryService().createDraft(
      omitUndefined({
        code: body.code,
        slug: body.slug,
        labelBn: body.labelBn,
        labelEn: body.labelEn,
        category: body.category as DiDiseaseCategory,
        species: body.species?.map((s) => apiSpeciesToPrisma(s)),
      }),
    );
    sendCreated(res, { registry: row });
  }

  async adminIngestOutbreak(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        diseaseSlug: z.string(),
        registryId: z.string().optional(),
        divisionId: z.string().optional(),
        districtId: z.string().optional(),
        riskIndex: z.number().int().min(0).max(100),
        effectiveDate: z.string(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const signal = await getOutbreakIntelligenceService().ingestAdminSignal(
      omitUndefined({
        diseaseSlug: body.diseaseSlug,
        registryId: body.registryId,
        divisionId: body.divisionId,
        districtId: body.districtId,
        riskIndex: body.riskIndex,
        effectiveDate: new Date(body.effectiveDate),
        notes: body.notes,
      }),
    );
    sendCreated(res, { signal });
  }

  async adminMigrateLegacy(_req: Request, res: Response): Promise<void> {
    const graph = await getDiseaseReasoningOrchestratorService().migrateLegacyGraph();
    const outbreaks = await getOutbreakIntelligenceService().syncLegacy();
    sendSuccess(res, { graph, outbreaksSynced: outbreaks });
  }
}
