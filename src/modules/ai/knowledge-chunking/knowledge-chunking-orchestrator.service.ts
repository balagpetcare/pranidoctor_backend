import { getPrisma } from '../../../shared/database/prisma.js';
import { toInputJson } from '../../../shared/database/prisma-json.js';
import { getCitationEngineService } from './citation/citation-engine.service.js';
import { getChunkEngineService } from './chunking/chunk-engine.service.js';
import { getConfidenceAssignmentService } from './confidence/confidence-assignment.service.js';
import { getEvidenceAssignmentService } from './evidence/evidence-assignment.service.js';
import { ChunkPublishGateError, KnowledgeVersionNotFoundForChunkingError } from './knowledge-chunking.errors.js';
import type { ProcessVersionInput, ProcessVersionResult } from './knowledge-chunking.types.js';
import { getChunkMetadataEnricher } from './metadata/chunk-metadata.enricher.js';
import { getKnowledgeChunkRepository } from './repositories/knowledge-chunk.repository.js';
import { getKnowledgeConfidenceRepository } from './repositories/knowledge-confidence.repository.js';
import { getKnowledgeEvidenceRepository } from './repositories/knowledge-evidence.repository.js';
import { resolveChunkPolicyForDomain } from './policies/chunk-policy.registry.js';
import { toCitationSourceContext } from '../knowledge-ingestion/citation/citation.service.js';

export class KnowledgeChunkingOrchestratorService {
  readonly name = 'KnowledgeChunkingOrchestratorService';

  async processVersion(input: ProcessVersionInput): Promise<ProcessVersionResult> {
    const version = await getPrisma().vkKnowledgeVersion.findUnique({
      where: { id: input.versionId },
      include: {
        entity: true,
        citations: { include: { source: true } },
      },
    });
    if (!version) throw new KnowledgeVersionNotFoundForChunkingError(input.versionId);

    const policyId = resolveChunkPolicyForDomain(
      version.entity.domain,
      input.chunkPolicyId ?? version.chunkPolicyId,
    );

    if (!version.chunkPolicyId) {
      await getPrisma().vkKnowledgeVersion.update({
        where: { id: input.versionId },
        data: { chunkPolicyId: policyId },
      });
    }

    const chunkDrafts = getChunkEngineService().buildChunks({
      domain: version.entity.domain,
      titleBn: version.titleBn,
      titleEn: version.titleEn,
      bodyBn: version.bodyBn,
      bodyEn: version.bodyEn,
      structuredJson: version.structuredJson as Record<string, unknown> | null,
      chunkPolicyId: policyId,
    });

    const primaryCitation = version.citations[0];
    const sourceClass = primaryCitation?.source.sourceClass ?? 'FEED_REFERENCE';
    const trustTier = primaryCitation?.source.trustTier ?? 3;
    const defaultLevel = primaryCitation?.source.defaultEvidenceLevel ?? 'L3';

    const evidenceSvc = getEvidenceAssignmentService();
    const priorEvidenceRow = await getKnowledgeEvidenceRepository().findLatest(input.versionId);

    const evidence = input.finalizeEvidence && priorEvidenceRow
      ? evidenceSvc.finalize({
          provisionalLevel: priorEvidenceRow.evidenceLevel,
          clinicalRiskTier: version.clinicalRiskTier,
          domain: version.entity.domain,
        })
      : evidenceSvc.assignProvisional({
          sourceClass,
          sourceDefaultLevel: defaultLevel,
          domain: version.entity.domain,
          trustTier,
          aiGeneratedDraft: version.aiGeneratedDraft,
          hasStructuredRegistration: Boolean(
            version.structuredJson &&
              typeof version.structuredJson === 'object' &&
              'registrationNo' in (version.structuredJson as object),
          ),
        });

    await getKnowledgeEvidenceRepository().append({
      versionId: input.versionId,
      evidenceLevel: evidence.evidenceLevel,
      assessmentMethod: evidence.assessmentMethod,
      rationaleBn: evidence.rationaleBn,
      rationaleEn: evidence.rationaleEn,
      provisional: evidence.provisional,
      ...(input.assessorId ? { assessorId: input.assessorId } : {}),
      ...(priorEvidenceRow ? { supersedesEvidenceId: priorEvidenceRow.id } : {}),
    });

    const confidence = getConfidenceAssignmentService().compute({
      evidenceLevel: evidence.evidenceLevel,
      trustTier,
      provisional: evidence.provisional,
      computedBy: 'INGEST_PIPELINE',
      clinicalRiskTier: version.clinicalRiskTier,
    });

    await getKnowledgeConfidenceRepository().append({
      versionId: input.versionId,
      score: confidence.score,
      formulaVersion: confidence.formulaVersion,
      componentsJson: confidence.components as unknown as Record<string, unknown>,
      provisional: confidence.provisional,
      computedBy: confidence.computedBy,
      meetsProfileGatesJson: confidence.meetsProfileGates,
    });

    const chunkCitations = getCitationEngineService().attachChunkCitations({
      chunks: chunkDrafts,
      versionCitations: version.citations.map((c) => ({
        sourceId: c.sourceId,
        documentId: c.documentId,
        pageRef: c.pageRef,
        sectionRef: c.sectionRef,
        tableRef: c.tableRef,
        rowRef: c.rowRef,
        spanRefsJson: c.spanRefsJson as unknown,
        contributionWeight: c.contributionWeight,
        inlineCitationKey: c.inlineCitationKey,
        source: toCitationSourceContext(c.source as never),
        sourceTrustTier: c.source.trustTier,
      })),
    });

    const enricher = getChunkMetadataEnricher();
    const enriched = chunkDrafts.map((chunk) => {
      const citation = chunkCitations.find((c) => c.chunkIndex === chunk.chunkIndex);
      const metadataJson = enricher.enrich({
        chunk,
        entity: version.entity,
        version: {
          id: version.id,
          species: version.species,
          audience: version.audience,
          regionScope: version.regionScope,
          clinicalRiskTier: version.clinicalRiskTier,
          importRunId: version.importRunId,
        },
        evidence,
        confidence,
        ...(citation ? { citation } : {}),
      });
      return { ...chunk, metadataJson };
    });

    const createdChunks = await getKnowledgeChunkRepository().createStagingBatch(input.versionId, enriched);

    await getPrisma().vkKnowledgeCitation.deleteMany({
      where: { versionId: input.versionId, chunkId: { not: null } },
    });

    for (const row of createdChunks) {
      const citation = chunkCitations.find((c) => c.chunkIndex === row.chunkIndex);
      if (!citation) continue;

      await getPrisma().vkKnowledgeCitation.create({
        data: {
          versionId: input.versionId,
          chunkId: row.id,
          sourceId: citation.sourceId,
          documentId: citation.documentId ?? null,
          pageRef: citation.pageRef ?? null,
          sectionRef: citation.sectionRef ?? null,
          tableRef: citation.tableRef ?? null,
          rowRef: citation.rowRef ?? null,
          ...(citation.spanRefsJson != null
            ? { spanRefsJson: toInputJson(citation.spanRefsJson) }
            : {}),
          contributionWeight: citation.contributionWeight,
          inlineCitationKey: citation.inlineCitationKey,
          humanCitationBn: citation.humanCitationBn,
          humanCitationEn: citation.humanCitationEn,
        },
      });
    }

    return {
      versionId: input.versionId,
      chunkCount: createdChunks.length,
      evidenceLevel: evidence.evidenceLevel,
      confidenceScore: confidence.score,
      provisional: confidence.provisional,
    };
  }

  async promotePublishedChunks(versionId: string) {
    const staging = await getKnowledgeChunkRepository().listByVersion(versionId, 'STAGING');
    if (staging.length === 0) {
      throw new ChunkPublishGateError('NO_STAGING_CHUNKS', 'No staging chunks to publish');
    }

    const version = await getPrisma().vkKnowledgeVersion.findUnique({
      where: { id: versionId },
      include: { citations: true },
    });
    if (!version) throw new KnowledgeVersionNotFoundForChunkingError(versionId);

    if (version.clinicalRiskTier === 'HIGH' || version.clinicalRiskTier === 'CRITICAL') {
      const chunkCitations = version.citations.filter((c) => c.chunkId);
      if (chunkCitations.length < staging.length) {
        throw new ChunkPublishGateError(
          'CHUNK_CITATION_INCOMPLETE',
          'HIGH/CRITICAL versions require per-chunk citations',
        );
      }
    }

    const latestEvidence = await getKnowledgeEvidenceRepository().findLatest(versionId);
    if (
      (version.clinicalRiskTier === 'HIGH' || version.clinicalRiskTier === 'CRITICAL') &&
      latestEvidence?.provisional
    ) {
      throw new ChunkPublishGateError(
        'EVIDENCE_PROVISIONAL',
        'Clinical versions require non-provisional evidence before publish',
      );
    }

    const published = await getKnowledgeChunkRepository().promoteStagingToPublished(versionId);

    const stagingByIndex = new Map(staging.map((c) => [c.chunkIndex, c.id]));
    for (const pub of published) {
      const stagingId = stagingByIndex.get(pub.chunkIndex);
      if (!stagingId) continue;
      await getPrisma().vkKnowledgeCitation.updateMany({
        where: { versionId, chunkId: stagingId },
        data: { chunkId: pub.id },
      });
    }

    const primaryCitation = version.citations.find((c) => !c.chunkId) ?? version.citations[0];
    const trustTier = primaryCitation
      ? (
          await getPrisma().aiKnowledgeSource.findUnique({
            where: { id: primaryCitation.sourceId },
            select: { trustTier: true },
          })
        )?.trustTier ?? 3
      : 3;

    const finalConfidence = getConfidenceAssignmentService().compute({
      evidenceLevel: latestEvidence?.evidenceLevel ?? 'L3',
      trustTier,
      provisional: false,
      computedBy: 'PUBLISH_JOB',
      clinicalRiskTier: version.clinicalRiskTier,
      reviewCompletenessScore: 1,
    });

    await getKnowledgeConfidenceRepository().append({
      versionId,
      score: finalConfidence.score,
      formulaVersion: finalConfidence.formulaVersion,
      componentsJson: finalConfidence.components as unknown as Record<string, unknown>,
      provisional: false,
      computedBy: 'PUBLISH_JOB',
      meetsProfileGatesJson: finalConfidence.meetsProfileGates,
    });

    for (const pub of published) {
      const meta = pub.metadataJson as Record<string, unknown> | null;
      if (!meta || typeof meta !== 'object') continue;
      await getPrisma().vkKnowledgeChunk.update({
        where: { id: pub.id },
        data: {
          metadataJson: toInputJson({
            ...meta,
            provisional: false,
            confidenceScore: finalConfidence.score,
            computedAt: new Date().toISOString(),
          }),
        },
      });
    }

    return {
      versionId,
      publishedChunkCount: published.length,
      chunkIndexes: published.map((c) => c.chunkIndex),
    };
  }

  async buildRagHandoffPayload(versionId: string) {
    const chunks = await getKnowledgeChunkRepository().listByVersion(versionId, 'PUBLISHED');
    const enricher = getChunkMetadataEnricher();
    return {
      versionId,
      chunks: chunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        contentBn: c.contentBn,
        contentEn: c.contentEn,
        metadata: c.metadataJson,
        embeddingText: enricher.buildEmbeddingText(
          c.metadataJson as never,
          c.contentBn,
          c.contentEn,
        ),
      })),
    };
  }
}

let service: KnowledgeChunkingOrchestratorService | null = null;

export function getKnowledgeChunkingOrchestratorService(): KnowledgeChunkingOrchestratorService {
  if (!service) service = new KnowledgeChunkingOrchestratorService();
  return service;
}

export function resetKnowledgeChunkingOrchestratorForTests(): void {
  service = null;
}
