import type { Prisma } from '../../../../generated/prisma/index.js';
import type {
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeSource,
  VkKnowledgeDomain,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { buildSearchText } from '../../knowledge-foundation/knowledge-foundation.types.js';
import { defaultInlineCitationKey } from '../../knowledge-foundation/knowledge-foundation.util.js';
import {
  renderHumanCitation,
  toCitationSourceContext,
} from '../../knowledge-ingestion/citation/citation.service.js';
import type { DedupResult, ImportActor, NormalizedEntityDraft } from '../knowledge-import.types.js';
import { getKnowledgeChunkingOrchestratorService } from '../../knowledge-chunking/index.js';

export class VersionEngineService {
  readonly name = 'VersionEngineService';

  async createVersionFromDraft(params: {
    draft: NormalizedEntityDraft;
    dedup: DedupResult;
    source: AiKnowledgeSource;
    documentId?: string;
    importRunId: string;
    dryRun: boolean;
    actor?: ImportActor;
  }): Promise<{ entityId: string; versionId: string; created: boolean } | null> {
    if (params.dedup.decision === 'SKIP_DUPLICATE' || params.dedup.decision === 'QUARANTINE_CONFLICT') {
      return null;
    }

    if (params.dryRun) {
      return {
        entityId: 'dry-run',
        versionId: 'dry-run',
        created: params.dedup.decision === 'CREATE_NEW',
      };
    }

    const searchText = buildSearchText({
      titleBn: params.draft.titleBn,
      titleEn: params.draft.titleEn,
      bodyBn: params.draft.bodyBn,
      bodyEn: params.draft.bodyEn,
    });

    const domain = params.draft.domain as VkKnowledgeDomain;
    const clinicalRiskTier = params.draft.clinicalRiskTier as AiKnowledgeClinicalRiskTier;
    const species = params.draft.species as never[];

    if (params.dedup.decision === 'CREATE_NEW') {
      const result = await getPrisma().$transaction(async (tx) => {
        const entity = await tx.vkKnowledgeEntity.create({
          data: {
            domain,
            entityType: params.draft.entityType,
            slug: params.draft.slug,
            createdById: params.actor?.id ?? null,
          },
        });

        const version = await tx.vkKnowledgeVersion.create({
          data: {
            entityId: entity.id,
            versionNumber: 1,
            status: 'DRAFT',
            titleBn: params.draft.titleBn,
            titleEn: params.draft.titleEn,
            ...(params.draft.summaryBn ? { summaryBn: params.draft.summaryBn } : {}),
            ...(params.draft.summaryEn ? { summaryEn: params.draft.summaryEn } : {}),
            bodyBn: params.draft.bodyBn,
            bodyEn: params.draft.bodyEn,
            species,
            audience: params.draft.audience,
            regionScope: params.draft.regionScope,
            clinicalRiskTier,
            searchText,
            keywordsBn: params.draft.keywordsBn ?? [],
            keywordsEn: params.draft.keywordsEn ?? [],
            colloquialBn: params.draft.colloquialBn ?? [],
            ...(params.draft.chunkPolicyId ? { chunkPolicyId: params.draft.chunkPolicyId } : {}),
            ...(params.draft.structuredJson != null
              ? { structuredJson: toInputJson(params.draft.structuredJson) }
              : {}),
            aiGeneratedDraft: false,
            importRunId: params.importRunId,
            createdById: params.actor?.id ?? null,
          },
        });

        await tx.vkKnowledgeEntity.update({
          where: { id: entity.id },
          data: { currentDraftVersionId: version.id },
        });

        await this.createCitation(tx, {
          versionId: version.id,
          source: params.source,
          ...(params.documentId ? { documentId: params.documentId } : {}),
          draft: params.draft,
        });

        return { entityId: entity.id, versionId: version.id, created: true };
      });
      await this.indexChunks(result.versionId);
      return result;
    }

    const entityId = params.dedup.existingEntityId!;
    const result = await getPrisma().$transaction(async (tx) => {
      const entity = await tx.vkKnowledgeEntity.findUniqueOrThrow({ where: { id: entityId } });
      const latest = await tx.vkKnowledgeVersion.findFirst({
        where: { entityId },
        orderBy: { versionNumber: 'desc' },
      });
      const nextNumber = (latest?.versionNumber ?? 0) + 1;

      const version = await tx.vkKnowledgeVersion.create({
        data: {
          entityId,
          versionNumber: nextNumber,
          supersedesVersionId: entity.currentPublishedVersionId,
          status: 'DRAFT',
          titleBn: params.draft.titleBn,
          titleEn: params.draft.titleEn,
          ...(params.draft.summaryBn ? { summaryBn: params.draft.summaryBn } : {}),
          ...(params.draft.summaryEn ? { summaryEn: params.draft.summaryEn } : {}),
          bodyBn: params.draft.bodyBn,
          bodyEn: params.draft.bodyEn,
          species,
          audience: params.draft.audience,
          regionScope: params.draft.regionScope,
          clinicalRiskTier,
          searchText,
          keywordsBn: params.draft.keywordsBn ?? [],
          keywordsEn: params.draft.keywordsEn ?? [],
          colloquialBn: params.draft.colloquialBn ?? [],
          ...(params.draft.chunkPolicyId ? { chunkPolicyId: params.draft.chunkPolicyId } : {}),
          changeSummary: `Ingestion import ${params.importRunId}`,
          ...(params.draft.structuredJson != null
            ? { structuredJson: toInputJson(params.draft.structuredJson) }
            : {}),
          importRunId: params.importRunId,
          createdById: params.actor?.id ?? null,
        },
      });

      await tx.vkKnowledgeEntity.update({
        where: { id: entityId },
        data: { currentDraftVersionId: version.id },
      });

      await this.createCitation(tx, {
        versionId: version.id,
        source: params.source,
        ...(params.documentId ? { documentId: params.documentId } : {}),
        draft: params.draft,
      });

      return { entityId, versionId: version.id, created: false };
    });
    await this.indexChunks(result.versionId);
    return result;
  }

  private async indexChunks(versionId: string): Promise<void> {
    await getKnowledgeChunkingOrchestratorService().processVersion({ versionId });
  }

  private async createCitation(
    tx: Prisma.TransactionClient,
    params: {
      versionId: string;
      source: AiKnowledgeSource;
      documentId?: string;
      draft: NormalizedEntityDraft;
    },
  ) {
    const spans =
      params.draft.sourceSpanRefs && params.draft.sourceSpanRefs.length > 0
        ? params.draft.sourceSpanRefs
        : [{ page: undefined, sectionId: undefined }];

    const ctx = toCitationSourceContext(params.source);

    for (const span of spans) {
      const pageRef = span.page?.toString();
      const sectionRef = span.sectionId;
      const inlineKey = defaultInlineCitationKey(params.source.sourceKey, pageRef);

      await tx.vkKnowledgeCitation.create({
        data: {
          versionId: params.versionId,
          sourceId: params.source.id,
          documentId: params.documentId ?? null,
          pageRef: pageRef ?? null,
          sectionRef: sectionRef ?? null,
          inlineCitationKey: inlineKey,
          humanCitationBn: renderHumanCitation(ctx, 'bn', {
            ...(pageRef ? { pageRef } : {}),
            ...(sectionRef ? { sectionRef } : {}),
          }),
          humanCitationEn: renderHumanCitation(ctx, 'en', {
            ...(pageRef ? { pageRef } : {}),
            ...(sectionRef ? { sectionRef } : {}),
          }),
        },
      });
    }
  }
}

let service: VersionEngineService | null = null;

export function getVersionEngineService(): VersionEngineService {
  if (!service) service = new VersionEngineService();
  return service;
}

export function resetVersionEngineForTests(): void {
  service = null;
}
