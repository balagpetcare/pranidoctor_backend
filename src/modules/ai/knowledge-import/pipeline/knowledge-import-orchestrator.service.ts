import {
  AiKnowledgeImportRunStatus,
  type AiKnowledgeImportPipelineStage,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { ValidationError } from '../../../../shared/errors/http.errors.js';

import { parseCsvReferenceRows } from '../adapters/csv-reference.adapter.js';
import { getKnowledgeImportAuditService } from '../audit/knowledge-import-audit.service.js';
import { getChangeDetectionService } from '../change-detection/change-detection.service.js';
import { getDuplicateDetectionService } from '../deduplication/duplicate-detection.service.js';
import { KnowledgeImportRunNotFoundError } from '../knowledge-import.errors.js';
import {
  KNOWLEDGE_IMPORT_PIPELINE_VERSION,
  type ImportActor,
  type ImportPipelineStats,
  type RawExtract,
  type StartImportInput,
} from '../knowledge-import.types.js';
import { getNormalizationEngine } from '../normalization/normalization.engine.js';
import { getKnowledgeImportQueueService } from '../queues/knowledge-import-queue.service.js';
import { getQuarantineRepository } from '../repositories/quarantine.repository.js';
import { getValidationItemRepository } from '../repositories/validation-item.repository.js';
import { getKnowledgeImportRegistryService } from '../registry/knowledge-import-registry.service.js';
import { getApprovalRoutingService } from '../routing/approval-routing.service.js';
import { getValidationPipelineService } from '../validation/validation-pipeline.service.js';
import { getVersionEngineService } from '../versioning/version-engine.service.js';

type PipelineContext = {
  importRunId: string;
  source: Awaited<ReturnType<typeof getKnowledgeImportRegistryService.prototype.resolveImportContext>>['source'];
  profile: Awaited<ReturnType<typeof getKnowledgeImportRegistryService.prototype.resolveImportContext>>['profile'];
  document: Awaited<ReturnType<typeof getKnowledgeImportRegistryService.prototype.resolveImportContext>>['document'];
  dryRun: boolean;
  actor?: ImportActor;
  extracts: RawExtract[];
  stats: ImportPipelineStats;
  versionIds: string[];
  sectionHashes: Record<string, string>;
};

export class KnowledgeImportOrchestratorService {
  readonly name = 'KnowledgeImportOrchestratorService';

  async startImport(input: StartImportInput, actor?: ImportActor) {
    const registry = getKnowledgeImportRegistryService();
    const { source, profile, document } = await registry.resolveImportContext(
      input.sourceId,
      input.documentId,
    );

    try {
      registry.assertLicenseAllowsImport(source);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'LICENSE_ERROR';
      throw new ValidationError(code, `Import blocked: ${code}`);
    }

    const run = await getPrisma().aiKnowledgeImportRun.create({
      data: {
        sourceId: input.sourceId,
        documentId: input.documentId ?? document?.id ?? null,
        adapterId: profile.adapterId,
        profileKey: profile.profileKey,
        pipelineVersion: KNOWLEDGE_IMPORT_PIPELINE_VERSION,
        mode: input.mode ?? (input.dryRun ? 'DRY_RUN' : 'LIVE'),
        pipelineStage: 'INTAKE',
        dryRun: input.dryRun ?? false,
        triggeredById: input.triggeredById ?? actor?.id ?? null,
        status: AiKnowledgeImportRunStatus.RUNNING,
      },
    });

    await getKnowledgeImportAuditService().record({
      eventType: 'IMPORT_RUN_STARTED',
      importRunId: run.id,
      ...(actor ? { actor } : {}),
      detail: { sourceId: input.sourceId, profileKey: profile.profileKey },
    });

    await getKnowledgeImportQueueService().enqueuePipeline(run.id);

    const extracts = parseCsvReferenceRows(input.rows);

    const ctx: PipelineContext = {
      importRunId: run.id,
      source,
      profile,
      document,
      dryRun: input.dryRun ?? false,
      ...(actor ? { actor } : {}),
      extracts,
      stats: emptyStats(extracts.length),
      versionIds: [],
      sectionHashes: {},
    };

    if (input.sync !== false) {
      try {
        await this.runPipeline(ctx);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await getPrisma().aiKnowledgeImportRun.update({
          where: { id: run.id },
          data: {
            status: AiKnowledgeImportRunStatus.FAILED,
            completedAt: new Date(),
            errorSummary: message,
          },
        });
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_RUN_FAILED',
          importRunId: run.id,
          detail: { error: message, stage: 'PIPELINE' },
          ...(actor ? { actor } : {}),
        });
        throw error;
      }
    } else {
      await getPrisma().aiKnowledgeImportRun.update({
        where: { id: run.id },
        data: {
          pipelineStage: 'QUEUED',
          statsJson: toInputJson({ pendingExtracts: extracts.length }),
        },
      });
    }

    const updated = await this.getImportRun(run.id);
    return {
      importRunId: run.id,
      stats: (updated.statsJson as ImportPipelineStats | null) ?? ctx.stats,
      versionIds: ctx.versionIds,
    };
  }

  async processImportRun(importRunId: string, rows: Array<Record<string, unknown>>, actor?: ImportActor) {
    const run = await this.getImportRun(importRunId);
    const registry = getKnowledgeImportRegistryService();
    const { source, profile, document } = await registry.resolveImportContext(run.sourceId, run.documentId ?? undefined);

    const ctx: PipelineContext = {
      importRunId,
      source,
      profile,
      document,
      dryRun: run.dryRun,
      ...(actor ? { actor } : {}),
      extracts: parseCsvReferenceRows(rows),
      stats: emptyStats(0),
      versionIds: [],
      sectionHashes: {},
    };

    await this.runPipeline(ctx);
    const updated = await this.getImportRun(importRunId);
    return {
      importRunId,
      stats: (updated.statsJson as ImportPipelineStats | null) ?? ctx.stats,
      versionIds: ctx.versionIds,
    };
  }

  async getImportRun(importRunId: string) {
    const run = await getPrisma().aiKnowledgeImportRun.findUnique({
      where: { id: importRunId },
      include: {
        source: true,
        document: true,
        validationItems: true,
        quarantineRecords: true,
        importJobs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new KnowledgeImportRunNotFoundError(importRunId);
    return run;
  }

  async listImportRuns(sourceId?: string) {
    return getPrisma().aiKnowledgeImportRun.findMany({
      ...(sourceId ? { where: { sourceId } } : {}),
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  private async runPipeline(ctx: PipelineContext) {
    await this.updateStage(ctx.importRunId, 'EXTRACTING');
    ctx.stats.extracted = ctx.extracts.length;

    for (const e of ctx.extracts) {
      if (e.sectionHash) ctx.sectionHashes[e.slug] = e.sectionHash;
    }

    if (ctx.document?.id) {
      const changes = await getChangeDetectionService().detectDocumentChanges({
        sourceId: ctx.source.id,
        documentId: ctx.document.id,
        currentExtracts: ctx.extracts,
      });
      ctx.extracts = [...changes.added, ...changes.modified];
      ctx.stats.skipped += changes.unchanged.length;
    }

    await getKnowledgeImportAuditService().record({
      eventType: 'IMPORT_EXTRACT_COMPLETE',
      importRunId: ctx.importRunId,
      detail: { extractCount: ctx.extracts.length },
    });
    await this.updateStage(ctx.importRunId, 'EXTRACT_COMPLETE');

    await this.updateStage(ctx.importRunId, 'VALIDATING');
    await getValidationItemRepository().createBatch(
      ctx.importRunId,
      ctx.extracts.map((e) => ({ extractIndex: e.extractIndex, payloadJson: e as unknown as Record<string, unknown> })),
    );

    const validator = getValidationPipelineService();
    const validationRepo = getValidationItemRepository();
    const licenseActive = !ctx.source.license?.expiryDate || ctx.source.license.expiryDate >= new Date();
    const validatedExtracts: RawExtract[] = [];

    for (const extract of ctx.extracts) {
      const result = validator.validateExtract(extract, {
        licenseActive,
        allowsAiExtraction: ctx.source.license?.allowsAiExtraction ?? true,
        allowedDomains: ctx.profile.allowedDomains,
      });

      if (!result.passed) {
        ctx.stats.quarantined += 1;
        const failureCodes = result.failures.map((f) => f.code);
        for (const failure of result.failures) {
          await getQuarantineRepository().record({
            importRunId: ctx.importRunId,
            extractIndex: extract.extractIndex,
            reasonCode: failure.code,
            message: failure.message,
            rawSnapshotJson: extract as unknown as Record<string, unknown>,
          });
        }
        await validationRepo.markByExtractIndex(
          ctx.importRunId,
          extract.extractIndex,
          'FAILED',
          failureCodes,
        );
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_VALIDATION_FAILED',
          importRunId: ctx.importRunId,
          detail: { extractIndex: extract.extractIndex, failures: result.failures },
        });
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_QUARANTINED',
          importRunId: ctx.importRunId,
          detail: { extractIndex: extract.extractIndex, reasonCodes: failureCodes, stage: 'VALIDATION' },
        });
        continue;
      }

      ctx.stats.validated += 1;
      validatedExtracts.push(extract);
      await validationRepo.markByExtractIndex(ctx.importRunId, extract.extractIndex, 'PASSED');
      await getKnowledgeImportAuditService().record({
        eventType: 'IMPORT_VALIDATION_PASSED',
        importRunId: ctx.importRunId,
        detail: { extractIndex: extract.extractIndex },
      });
    }

    await this.updateStage(ctx.importRunId, 'NORMALIZING');
    const normalizer = getNormalizationEngine();
    const provenance = {
      importRunId: ctx.importRunId,
      sourceId: ctx.source.id,
      documentId: ctx.document?.id,
      adapterId: ctx.profile.adapterId,
    };

    const drafts = validatedExtracts.map((extract) =>
      normalizer.normalizeExtract(extract, ctx.profile, provenance),
    );
    ctx.stats.normalized = drafts.length;

    await this.updateStage(ctx.importRunId, 'DEDUPING');
    const deduper = getDuplicateDetectionService();
    const seenKeys = new Set<string>();

    await this.updateStage(ctx.importRunId, 'VERSIONING');
    const versionEngine = getVersionEngineService();

    for (const draft of drafts) {
      const dedup = await deduper.detect(draft, {
        importRunId: ctx.importRunId,
        ...(ctx.document?.checksumSha256 ? { documentChecksum: ctx.document.checksumSha256 } : {}),
        seenKeys,
      });

      if (dedup.decision === 'QUARANTINE_CONFLICT') {
        ctx.stats.quarantined += 1;
        await getQuarantineRepository().record({
          importRunId: ctx.importRunId,
          extractIndex: draft.extractIndex,
          reasonCode: 'QUARANTINE_CONFLICT',
          message: 'Irreconcilable conflict with published version',
          rawSnapshotJson: draft as unknown as Record<string, unknown>,
        });
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_QUARANTINED',
          importRunId: ctx.importRunId,
          detail: {
            extractIndex: draft.extractIndex,
            reasonCodes: ['QUARANTINE_CONFLICT'],
            stage: 'DEDUP',
            slug: draft.slug,
          },
        });
        continue;
      }

      if (dedup.decision === 'SKIP_DUPLICATE') {
        ctx.stats.skipped += 1;
        continue;
      }

      const versionResult = await versionEngine.createVersionFromDraft({
        draft,
        dedup,
        source: ctx.source,
        ...(ctx.document?.id ? { documentId: ctx.document.id } : {}),
        importRunId: ctx.importRunId,
        dryRun: ctx.dryRun,
        ...(ctx.actor ? { actor: ctx.actor } : {}),
      });

      if (!versionResult) continue;

      ctx.stats.versionsCreated += 1;
      if (versionResult.versionId !== 'dry-run') {
        ctx.versionIds.push(versionResult.versionId);
      }

      await getKnowledgeImportAuditService().record({
        eventType: 'IMPORT_VERSION_CREATED',
        importRunId: ctx.importRunId,
        entityId: versionResult.entityId,
        versionId: versionResult.versionId,
        detail: { dedupDecision: dedup.decision, slug: draft.slug },
        ...(ctx.actor ? { actor: ctx.actor } : {}),
      });
    }

    await this.updateStage(ctx.importRunId, 'ROUTING');
    const router = getApprovalRoutingService();
    const autoSubmit = ctx.profile.defaultClinicalRiskTier === 'LOW';

    for (const versionId of ctx.versionIds) {
      const version = await getPrisma().vkKnowledgeVersion.findUnique({
        where: { id: versionId },
        include: { entity: true },
      });
      if (!version) continue;

      const draft = drafts.find((d) => d.slug === version.entity.slug);
      if (!draft) continue;

      const route = await router.routeImportedVersion({
        versionId,
        entityId: version.entityId,
        draft,
        profile: ctx.profile,
        importRunId: ctx.importRunId,
        autoSubmit,
        ...(ctx.actor ? { actor: ctx.actor } : {}),
      });

      if (route === 'EDITORIAL') {
        ctx.stats.routedEditorial += 1;
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_ROUTED_EDITORIAL',
          importRunId: ctx.importRunId,
          entityId: version.entityId,
          versionId,
        });
      } else if (route === 'VET') {
        ctx.stats.routedVet += 1;
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_ROUTED_VET',
          importRunId: ctx.importRunId,
          entityId: version.entityId,
          versionId,
        });
      }
    }

    const status =
      ctx.stats.quarantined > 0 && ctx.stats.versionsCreated === 0
        ? AiKnowledgeImportRunStatus.FAILED
        : ctx.stats.quarantined > 0
          ? AiKnowledgeImportRunStatus.PARTIAL
          : AiKnowledgeImportRunStatus.COMPLETED;

    await getPrisma().aiKnowledgeImportRun.update({
      where: { id: ctx.importRunId },
      data: {
        pipelineStage: 'COMPLETED',
        status,
        completedAt: new Date(),
        statsJson: toInputJson({ ...ctx.stats, sectionHashes: ctx.sectionHashes }),
        validationSummaryJson: toInputJson({
          validated: ctx.stats.validated,
          quarantined: ctx.stats.quarantined,
        }),
      },
    });

    await getKnowledgeImportAuditService().record({
      eventType: status === AiKnowledgeImportRunStatus.FAILED ? 'IMPORT_RUN_FAILED' : 'IMPORT_RUN_COMPLETED',
      importRunId: ctx.importRunId,
      detail: { stats: ctx.stats, status },
    });

    await getKnowledgeImportQueueService().finalizeJobs(ctx.importRunId);
  }

  private async updateStage(importRunId: string, stage: AiKnowledgeImportPipelineStage) {
    await getPrisma().aiKnowledgeImportRun.update({
      where: { id: importRunId },
      data: { pipelineStage: stage },
    });
  }
}

function emptyStats(total: number): ImportPipelineStats {
  return {
    total,
    extracted: 0,
    validated: 0,
    normalized: 0,
    versionsCreated: 0,
    skipped: 0,
    quarantined: 0,
    routedEditorial: 0,
    routedVet: 0,
  };
}

let service: KnowledgeImportOrchestratorService | null = null;

export function getKnowledgeImportOrchestratorService(): KnowledgeImportOrchestratorService {
  if (!service) service = new KnowledgeImportOrchestratorService();
  return service;
}

export function resetKnowledgeImportOrchestratorForTests(): void {
  service = null;
}
