import type { Prisma, LivestockSpecies } from '../../../../generated/prisma/index.js';
import {
  AiKnowledgeAudience,
  AiKnowledgeChunkStage,
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeImportRunStatus,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { NotFoundError, ValidationError } from '../../../../shared/errors/http.errors.js';

import {
  buildCitationBlock,
  buildSourceAttribution,
  citationJsonFromAttribution,
  renderHumanCitation,
  renderInlineRagCitation,
  toCitationSourceContext,
} from '../citation/citation.service.js';
import { buildChunksForEntry, resolveChunkPolicyId } from '../chunking/chunk-pipeline.service.js';
import { KnowledgeSourceNotFoundError } from '../knowledge-ingestion.errors.js';
import type { ImportPipelineInput, ImportPipelineStats } from '../knowledge-ingestion.types.js';
import { KNOWLEDGE_PIPELINE_VERSION } from '../knowledge-ingestion.types.js';
import {
  buildSearchText,
  dedupKeyForRow,
  normalizeImportRow,
} from '../normalization/knowledge-normalizer.js';
import { assignProvisionalEvidenceLevel, inferClinicalRiskTier } from '../scoring/evidence-level.engine.js';
import { computeConfidenceScore } from '../scoring/confidence.engine.js';
import { getKnowledgeEditorialWorkflowService } from '../workflow/editorial-workflow.service.js';

export class KnowledgeImportPipelineService {
  readonly name = 'KnowledgeImportPipelineService';

  async runImport(input: ImportPipelineInput): Promise<{
    importRunId: string;
    stats: ImportPipelineStats;
    entryIds: string[];
  }> {
    const source = await getPrisma().aiKnowledgeSource.findUnique({
      where: { id: input.sourceId },
      include: { license: true },
    });
    if (!source) throw new KnowledgeSourceNotFoundError(input.sourceId);

    if (source.license && !source.license.allowsAiExtraction) {
      throw new ValidationError('LICENSE_BLOCKS_EXTRACTION', 'Source license blocks ingestion');
    }

    const run = await getPrisma().aiKnowledgeImportRun.create({
      data: {
        sourceId: input.sourceId,
        documentId: input.documentId ?? null,
        adapterId: input.adapterId,
        pipelineVersion: KNOWLEDGE_PIPELINE_VERSION,
        dryRun: input.dryRun ?? false,
        triggeredById: input.triggeredById ?? null,
        status: AiKnowledgeImportRunStatus.RUNNING,
      },
    });

    const stats: ImportPipelineStats = {
      total: input.rows.length,
      created: 0,
      updated: 0,
      merged: 0,
      quarantined: 0,
      skipped: 0,
      quarantineErrors: [],
    };
    const entryIds: string[] = [];
    const seenKeys = new Set<string>();

    for (const rawRow of input.rows) {
      try {
        const row = normalizeImportRow(rawRow);
        const key = dedupKeyForRow(row);
        if (seenKeys.has(key)) {
          stats.skipped += 1;
          continue;
        }
        seenKeys.add(key);

        const existing = await getPrisma().aiKnowledgeEntry.findUnique({ where: { slug: row.slug } });
        if (existing && existing.status === AiKnowledgeStatus.PUBLISHED) {
          stats.skipped += 1;
          continue;
        }

        const chunkPolicyId = resolveChunkPolicyId(row.contentType, row.chunkPolicyId);
        const clinicalRiskTier = row.clinicalRiskTier ?? inferClinicalRiskTier(row.contentType);
        const provisionalEvidence = assignProvisionalEvidenceLevel({
          sourceClass: source.sourceClass,
          sourceDefaultLevel: source.defaultEvidenceLevel,
          contentType: row.contentType,
          hasRegistrationField: Boolean(row.structuredJson?.registrationNo),
        });
        const provisionalConfidence = computeConfidenceScore({
          evidenceLevel: provisionalEvidence,
          trustTier: source.trustTier,
          extractQualityScore: 0.8,
          dedupConfidence: existing ? 0.8 : 1,
          provisional: true,
        });

        const attribution = buildSourceAttribution({
          sourceId: source.id,
          ...(input.documentId ? { documentId: input.documentId } : {}),
          importRunId: run.id,
          ...(row.sourceSpanRefs?.length ? { spanRefs: row.sourceSpanRefs } : {}),
        });

        const citationContext = toCitationSourceContext(source);
        const citationBn = renderHumanCitation(citationContext, 'bn');
        const citationEn = renderHumanCitation(citationContext, 'en');
        const inline = renderInlineRagCitation(source.sourceKey);

        const metadataJson = {
          origin: 'INGESTION',
          importRunId: run.id,
          adapterId: input.adapterId,
          sourceAttributions: [attribution],
          structuredJson: row.structuredJson ?? null,
          citationBlockBn: buildCitationBlock([{ title: row.titleBn, citation: citationBn }], 'bn'),
          citationBlockEn: buildCitationBlock([{ title: row.titleEn, citation: citationEn }], 'en'),
        };

        if (input.dryRun) {
          if (existing) stats.updated += 1;
          else stats.created += 1;
          continue;
        }

        const searchText = buildSearchText(row);
        const audience =
          row.audience === 'DOCTOR'
            ? AiKnowledgeAudience.DOCTOR
            : row.audience === 'BOTH'
              ? AiKnowledgeAudience.BOTH
              : AiKnowledgeAudience.FARMER;

        const entryPayload: Prisma.AiKnowledgeEntryUncheckedCreateInput = {
          contentType: row.contentType,
          slug: row.slug,
          audience,
          titleBn: row.titleBn,
          titleEn: row.titleEn,
          bodyBn: row.bodyBn,
          bodyEn: row.bodyEn,
          species: (row.species ?? []) as LivestockSpecies[],
          sourceId: source.id,
          importRunId: run.id,
          chunkPolicyId,
          provisionalEvidenceLevel: provisionalEvidence,
          provisionalConfidenceScore: provisionalConfidence,
          clinicalRiskTier,
          embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING,
          searchText,
          metadataJson: toInputJson(metadataJson),
          createdById: input.triggeredById ?? null,
          status: AiKnowledgeStatus.DRAFT,
        };

        let entry;
        if (existing) {
          const { status: _status, ...updateFields } = entryPayload;
          entry = await getPrisma().aiKnowledgeEntry.update({
            where: { id: existing.id },
            data: {
              ...updateFields,
              status: AiKnowledgeStatus.DRAFT,
              version: { increment: 1 },
            },
          });
          stats.updated += 1;
        } else {
          entry = await getPrisma().aiKnowledgeEntry.create({
            data: entryPayload,
          });
          stats.created += 1;
        }

        await this.replaceStagingChunks(entry.id, row, chunkPolicyId, inline, attribution);
        await getKnowledgeEditorialWorkflowService().submitToEditorial({
          knowledgeEntryId: entry.id,
          queueSource: 'INGESTION',
          importRunId: run.id,
          ...(input.triggeredById ? { reviewerId: input.triggeredById } : {}),
        });

        entryIds.push(entry.id);
      } catch (error) {
        stats.quarantined += 1;
        const message = error instanceof Error ? error.message : 'Unknown import error';
        stats.quarantineErrors?.push({
          ...(typeof rawRow === 'object' && rawRow && 'slug' in rawRow && typeof rawRow.slug === 'string'
            ? { rowSlug: rawRow.slug }
            : {}),
          message,
        });
      }
    }

    const errorSummary =
      stats.quarantineErrors && stats.quarantineErrors.length > 0
        ? stats.quarantineErrors
            .slice(0, 20)
            .map((e) => `${e.rowSlug ?? 'unknown'}: ${e.message}`)
            .join('\n')
        : null;

    const status =
      stats.quarantined > 0 && stats.created + stats.updated === 0
        ? AiKnowledgeImportRunStatus.FAILED
        : stats.quarantined > 0
          ? AiKnowledgeImportRunStatus.PARTIAL
          : AiKnowledgeImportRunStatus.COMPLETED;

    await getPrisma().aiKnowledgeImportRun.update({
      where: { id: run.id },
      data: {
        status,
        completedAt: new Date(),
        statsJson: toInputJson(stats),
        ...(errorSummary ? { errorSummary } : {}),
      },
    });

    return { importRunId: run.id, stats, entryIds };
  }

  async getImportRun(importRunId: string) {
    const run = await getPrisma().aiKnowledgeImportRun.findUnique({
      where: { id: importRunId },
      include: { source: true, document: true, entries: { take: 50 } },
    });
    if (!run) throw new NotFoundError('IMPORT_RUN_NOT_FOUND', 'Import run not found');
    return run;
  }

  async listImportRuns(sourceId?: string) {
    return getPrisma().aiKnowledgeImportRun.findMany({
      ...(sourceId ? { where: { sourceId } } : {}),
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  private async replaceStagingChunks(
    knowledgeEntryId: string,
    row: ReturnType<typeof normalizeImportRow>,
    chunkPolicyId: string,
    inline: string,
    attribution: ReturnType<typeof buildSourceAttribution>,
  ) {
    await getPrisma().aiKnowledgeChunk.deleteMany({
      where: { knowledgeEntryId, stage: AiKnowledgeChunkStage.STAGING },
    });

    const chunks = buildChunksForEntry({
      titleBn: row.titleBn,
      titleEn: row.titleEn,
      bodyBn: row.bodyBn,
      bodyEn: row.bodyEn,
      contentType: row.contentType,
      chunkPolicyId,
    });

    if (chunks.length === 0) return;

    await getPrisma().aiKnowledgeChunk.createMany({
      data: chunks.map((chunk) => ({
        knowledgeEntryId,
        chunkIndex: chunk.chunkIndex,
        chunkPolicyId: chunk.chunkPolicyId,
        stage: AiKnowledgeChunkStage.STAGING,
        contentBn: chunk.contentBn,
        contentEn: chunk.contentEn,
        tokenEstimate: chunk.tokenEstimate,
        headingPath: chunk.headingPath ?? null,
        citationJson: toInputJson(citationJsonFromAttribution(attribution, inline)),
      })),
    });
  }
}

let importPipelineService: KnowledgeImportPipelineService | null = null;

export function getKnowledgeImportPipelineService(): KnowledgeImportPipelineService {
  if (!importPipelineService) importPipelineService = new KnowledgeImportPipelineService();
  return importPipelineService;
}

export function resetKnowledgeImportPipelineForTests(): void {
  importPipelineService = null;
}
