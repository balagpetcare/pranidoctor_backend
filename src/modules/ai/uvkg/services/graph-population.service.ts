import { getPrisma } from '../../../../shared/database/prisma.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import type { UvkgLinkUpsertInput, UvkgPopulationReport, UvkgSyncResult } from '../uvkg.types.js';
import { buildSourceLinkKey, normalizeSourceEdgeId } from '../uvkg.util.js';
import { getGraphSyncService } from './graph-sync.service.js';

function parseContraindicationRefs(json: unknown): string[] {
  if (!json || !Array.isArray(json)) return [];
  const refs: string[] = [];
  for (const item of json) {
    if (typeof item === 'string') refs.push(item);
    else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      if (typeof o.slug === 'string') refs.push(o.slug);
      else if (typeof o.diseaseCode === 'string') refs.push(o.diseaseCode);
      else if (typeof o.condition === 'string') refs.push(o.condition);
    }
  }
  return refs.filter(Boolean);
}

function emptySync(): UvkgSyncResult {
  return { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: [] };
}

/** Phase 4 — populate VkKnowledgeLink from all legacy + derived sources. */
export class GraphPopulationService {
  readonly name = 'GraphPopulationService';

  async runFullPopulation(): Promise<UvkgPopulationReport> {
    const startedAt = new Date().toISOString();
    const sync = getGraphSyncService();
    const repo = getKnowledgeLinkRepository();

    const sources: Record<string, UvkgSyncResult> = {
      feed: await sync.syncFromFeedGraph(),
      medicine: await sync.syncFromMedicineGraph(),
      disease: await sync.syncFromDiseaseGraph(),
      legacySymptom: await this.syncFromLegacySymptomLinks(),
      knowledgeCitations: await this.syncFromKnowledgeCitations(),
    };

    const derived: Record<string, number> = {
      medicineContraindications: await this.deriveFromMedicineContraindications(),
      diseaseSpecies: await this.deriveFromDiseaseSpeciesMatrix(),
      outbreakRegion: await this.deriveFromOutbreakSignals(),
      toxicFeedDisease: await this.deriveFromToxicFeedAlerts(),
      rationContains: await this.deriveFromRationTemplates(),
      nutrientSpecies: await this.deriveFromNutrientRequirements(),
    };

    const repair = await sync.repairSync();
    sources.repair = repair;

    const [totalLinksAfter, totalEntitiesReferenced, vkEntities] = await Promise.all([
      repo.countAll(),
      repo.countDistinctEndpointRefs(),
      repo.countVkKnowledgeEntities(),
    ]);

    await repo.recordAudit('PHASE4_POPULATION_COMPLETE', {
      sources,
      derived,
      totalLinksAfter,
      totalEntitiesReferenced,
      vkEntities,
    });

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      sources,
      derived,
      totalLinksAfter,
      totalEntitiesReferenced: Math.max(totalEntitiesReferenced, vkEntities),
    };
  }

  async syncFromLegacySymptomLinks(): Promise<UvkgSyncResult> {
    const result = emptySync();
    const prisma = getPrisma();
    const links = await prisma.aiSymptomDiseaseLink.findMany({
      include: {
        symptomNode: { select: { code: true } },
        knowledgeEntry: { select: { slug: true, status: true } },
      },
    });

    for (const link of links) {
      if (link.knowledgeEntry.status !== 'PUBLISHED') {
        result.skipped += 1;
        continue;
      }
      const sourceEdgeId = normalizeSourceEdgeId(
        `legacy-symptom:${link.symptomNodeId}:${link.knowledgeEntryId}`,
      );
      const input: UvkgLinkUpsertInput = {
        edgeType: 'HAS_SYMPTOM',
        edgeClass: 'CLINICAL',
        fromRefType: 'DISEASE',
        fromRefId: link.knowledgeEntry.slug,
        toRefType: 'SYMPTOM',
        toRefId: link.symptomNode.code,
        sourceSystem: 'LEGACY_SYMPTOM',
        sourceEdgeId,
        weight: link.edgeWeight,
        status: 'DRAFT',
        metadata: { legacyKnowledgeEntryId: link.knowledgeEntryId },
      };
      try {
        const existing = await getKnowledgeLinkRepository().findByLinkKey(
          buildSourceLinkKey('LEGACY_SYMPTOM', sourceEdgeId),
        );
        await getKnowledgeLinkRepository().upsertFromDualWrite(input);
        if (existing) result.updated += 1;
        else result.created += 1;
      } catch (e) {
        result.skipped += 1;
        result.errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return result;
  }

  async syncFromKnowledgeCitations(): Promise<UvkgSyncResult> {
    const result = emptySync();
    const prisma = getPrisma();
    const citations = await prisma.vkKnowledgeCitation.findMany({
      take: 15_000,
      include: {
        version: {
          select: {
            id: true,
            entity: { select: { slug: true, id: true } },
          },
        },
        source: { select: { id: true, sourceKey: true } },
      },
    });

    for (const citation of citations) {
      const sourceEdgeId = citation.id;
      try {
        await getKnowledgeLinkRepository().upsertFromDualWrite({
          edgeType: 'SUPPORTED_BY',
          edgeClass: 'METADATA',
          fromRefType: 'KNOWLEDGE_ENTITY',
          fromRefId: citation.version.entity.slug,
          toRefType: 'KNOWLEDGE_ENTITY',
          toRefId: citation.source.sourceKey,
          fromEntityId: citation.version.entity.id,
          sourceSystem: 'IMPORT',
          sourceEdgeId,
          weight: citation.contributionWeight,
          status: 'DRAFT',
          vkVersionId: citation.versionId,
          metadata: { citationId: citation.id },
        });
        result.created += 1;
      } catch (e) {
        result.skipped += 1;
        result.errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return result;
  }

  async deriveFromMedicineContraindications(): Promise<number> {
    const prisma = getPrisma();
    const generics = await prisma.medicineGeneric.findMany({
      where: { isActive: true },
      select: { genericCode: true, contraindicationsJson: true },
    });
    let n = 0;
    for (const g of generics) {
      for (const diseaseRef of parseContraindicationRefs(g.contraindicationsJson)) {
        const slug = diseaseRef.toLowerCase().replace(/_/g, '-');
        const sourceEdgeId = `med-ci:${g.genericCode}:${slug}`;
        await getKnowledgeLinkRepository().upsertFromDualWrite({
          edgeType: 'CONTRAINDICATES',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: slug,
          toRefType: 'MEDICINE_GENERIC',
          toRefId: g.genericCode,
          sourceSystem: 'IMPORT',
          sourceEdgeId,
          weight: 0.85,
          status: 'DRAFT',
          metadata: { derivedFrom: 'MedicineGeneric.contraindicationsJson' },
        });
        n += 1;
      }
    }
    return n;
  }

  async deriveFromDiseaseSpeciesMatrix(): Promise<number> {
    const prisma = getPrisma();
    const rows = await prisma.diDiseaseSpeciesMatrix.findMany({
      include: { registry: { select: { slug: true, status: true } } },
    });
    let n = 0;
    for (const row of rows) {
      if (row.registry.status !== 'ACTIVE') continue;
      const sourceEdgeId = `species-matrix:${row.id}`;
      await getKnowledgeLinkRepository().upsertFromDualWrite({
        edgeType: 'PREVALENT_IN',
        edgeClass: 'CLINICAL',
        fromRefType: 'DISEASE',
        fromRefId: row.registry.slug,
        toRefType: 'SPECIES',
        toRefId: row.species,
        sourceSystem: 'IMPORT',
        sourceEdgeId,
        weight: row.prevalenceBand === 'ENDEMIC' ? 0.9 : 0.7,
        species: [row.species],
        status: 'DRAFT',
        metadata: { prevalenceBand: row.prevalenceBand, endemicBd: row.endemicBd },
      });
      n += 1;
    }
    return n;
  }

  async deriveFromOutbreakSignals(): Promise<number> {
    const prisma = getPrisma();
    const signals = await prisma.diOutbreakSignal.findMany({ take: 5000 });
    let n = 0;
    for (const signal of signals) {
      const regionRef = signal.districtId ?? signal.divisionId ?? 'BD';
      const sourceEdgeId = `outbreak:${signal.id}`;
      await getKnowledgeLinkRepository().upsertFromDualWrite({
        edgeType: 'OUTBREAK_IN',
        edgeClass: 'CLINICAL',
        fromRefType: 'OUTBREAK',
        fromRefId: signal.id,
        toRefType: 'DISEASE',
        toRefId: signal.diseaseSlug,
        sourceSystem: 'IMPORT',
        sourceEdgeId,
        weight: Math.min(1, signal.confidence),
        regionScope: [regionRef],
        status: 'DRAFT',
        metadata: { riskIndex: signal.riskIndex, effectiveDate: signal.effectiveDate },
      });
      n += 1;

      await getKnowledgeLinkRepository().upsertFromDualWrite({
        edgeType: 'PREVALENT_IN',
        edgeClass: 'CLINICAL',
        fromRefType: 'DISEASE',
        fromRefId: signal.diseaseSlug,
        toRefType: 'REGION',
        toRefId: regionRef,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `outbreak-region:${signal.id}`,
        weight: 0.6,
        regionScope: [regionRef],
        status: 'DRAFT',
      });
      n += 1;
    }
    return n;
  }

  async deriveFromToxicFeedAlerts(): Promise<number> {
    const prisma = getPrisma();
    const alerts = await prisma.vkToxicFeedAlert.findMany({
      include: { version: { select: { status: true } } },
    });
    let n = 0;
    for (const alert of alerts) {
      if (alert.version.status !== 'PUBLISHED') continue;
      for (const code of alert.relatedIngredientCodes) {
        const sourceEdgeId = `toxic:${alert.id}:${code}`;
        await getKnowledgeLinkRepository().upsertFromDualWrite({
          edgeType: 'TOXIC_TO',
          edgeClass: 'CLINICAL',
          fromRefType: 'FEED_INGREDIENT',
          fromRefId: code,
          toRefType: 'SPECIES',
          toRefId: alert.speciesAffected[0] ?? 'CATTLE',
          sourceSystem: 'IMPORT',
          sourceEdgeId,
          weight: 0.95,
          species: alert.speciesAffected,
          status: 'DRAFT',
          metadata: { substance: alert.substance, alertId: alert.id },
        });
        n += 1;
      }
    }
    return n;
  }

  async deriveFromRationTemplates(): Promise<number> {
    const prisma = getPrisma();
    const templates = await prisma.vkRationTemplate.findMany({
      include: { version: { select: { status: true, entity: { select: { slug: true } } } } },
    });
    let n = 0;
    for (const t of templates) {
      if (t.version.status !== 'PUBLISHED') continue;
      const ingredients = Array.isArray(t.ingredientsJson)
        ? (t.ingredientsJson as Array<{ code?: string; ingredientCode?: string }>)
        : [];
      for (const ing of ingredients) {
        const code = ing.code ?? ing.ingredientCode;
        if (!code) continue;
        const sourceEdgeId = `ration:${t.templateCode}:${code}`;
        await getKnowledgeLinkRepository().upsertFromDualWrite({
          edgeType: 'CONTAINS',
          edgeClass: 'NUTRITIONAL',
          fromRefType: 'FEED_FORMULA',
          fromRefId: t.templateCode,
          toRefType: 'FEED_INGREDIENT',
          toRefId: code,
          sourceSystem: 'IMPORT',
          sourceEdgeId,
          weight: 0.8,
          status: 'DRAFT',
        });
        n += 1;
      }
    }
    return n;
  }

  async deriveFromNutrientRequirements(): Promise<number> {
    const prisma = getPrisma();
    const rows = await prisma.vkNutrientRequirement.findMany({
      include: { version: { select: { status: true, entity: { select: { slug: true } } } } },
    });
    let n = 0;
    for (const row of rows) {
      if (row.version.status !== 'PUBLISHED') continue;
      const sourceEdgeId = `nutrient:${row.id}`;
      await getKnowledgeLinkRepository().upsertFromDualWrite({
        edgeType: 'NUTRIENT_FOR',
        edgeClass: 'NUTRITIONAL',
        fromRefType: 'NUTRIENT',
        fromRefId: row.version.entity.slug,
        toRefType: 'SPECIES',
        toRefId: row.species,
        sourceSystem: 'IMPORT',
        sourceEdgeId,
        weight: 0.75,
        species: [row.species],
        status: 'DRAFT',
        metadata: { productionStage: row.productionStage },
      });
      n += 1;
    }
    return n;
  }
}

let population: GraphPopulationService | undefined;

export function getGraphPopulationService(): GraphPopulationService {
  population ??= new GraphPopulationService();
  return population;
}

export function resetGraphPopulationServiceForTests(): void {
  population = undefined;
}
