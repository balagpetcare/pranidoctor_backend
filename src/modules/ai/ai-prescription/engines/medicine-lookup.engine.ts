import {
  AiKnowledgeContentType,
  AiKnowledgeStatus,
  type LivestockSpecies,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { scoreTextMatch } from '../../knowledge-retrieval/search/lexical-scoring.util.js';

import { PRESCRIPTION_MAX_DRUG_LOOKUP } from '../ai-prescription.constants.js';
import type { DrugMatch } from '../ai-prescription.types.js';
import {
  buildMedicineCitation,
  parseMedicineStructured,
  scoreMedicineQueryMatch,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';

function toPublishedEntry(row: {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  species: LivestockSpecies[];
  confidenceScore: number | null;
  provisionalConfidenceScore: number | null;
  evidenceLevel: string | null;
  provisionalEvidenceLevel: string | null;
  metadataJson: unknown;
  source: { sourceKey: string } | null;
}): PublishedMedicineEntry {
  return {
    id: row.id,
    slug: row.slug,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    bodyBn: row.bodyBn,
    bodyEn: row.bodyEn,
    species: row.species,
    confidenceScore: row.confidenceScore ?? row.provisionalConfidenceScore ?? 0.5,
    evidenceLevel: row.evidenceLevel ?? row.provisionalEvidenceLevel ?? 'L2',
    metadataJson: row.metadataJson,
    ...(row.source?.sourceKey ? { sourceKey: row.source.sourceKey } : {}),
  };
}

export async function loadMedicineBySlugs(slugs: string[]): Promise<PublishedMedicineEntry[]> {
  if (slugs.length === 0) return [];
  const rows = await getPrisma().aiKnowledgeEntry.findMany({
    where: {
      slug: { in: slugs },
      contentType: AiKnowledgeContentType.MEDICINE,
      status: AiKnowledgeStatus.PUBLISHED,
    },
    include: { source: { select: { sourceKey: true } } },
  });
  return rows.map(toPublishedEntry);
}

export async function searchMedicines(params: {
  query: string;
  species?: LivestockSpecies;
  limit?: number;
}): Promise<DrugMatch[]> {
  const q = params.query.trim();
  if (!q) return [];

  const rows = await getPrisma().aiKnowledgeEntry.findMany({
    where: {
      contentType: AiKnowledgeContentType.MEDICINE,
      status: AiKnowledgeStatus.PUBLISHED,
      ...(params.species ? { species: { has: params.species } } : {}),
    },
    include: { source: { select: { sourceKey: true } } },
    take: 100,
    orderBy: { updatedAt: 'desc' },
  });

  const scored = rows
    .map((row) => {
      const entry = toPublishedEntry(row);
      const structured = parseMedicineStructured(entry.metadataJson);
      const textMatch = Math.max(
        scoreMedicineQueryMatch(entry, q),
        scoreTextMatch(row.searchText ?? '', q),
      );
      return { entry, structured, score: textMatch };
    })
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit ?? PRESCRIPTION_MAX_DRUG_LOOKUP);

  return scored.map(({ entry, structured, score }) => ({
    entityId: entry.id,
    slug: entry.slug,
    genericName: structured.genericName ?? entry.titleEn,
    brandNamesBd: structured.brandNamesBd ?? [],
    ...(structured.drugClass !== undefined ? { drugClass: structured.drugClass } : {}),
    prescriptionRequired: structured.prescriptionRequired ?? true,
    confidenceScore: score,
    citations: [buildMedicineCitation(entry)],
  }));
}

export class MedicineLookupEngine {
  readonly name = 'MedicineLookupEngine';

  search = searchMedicines;
  loadBySlugs = loadMedicineBySlugs;
}

let engine: MedicineLookupEngine | null = null;

export function getMedicineLookupEngine(): MedicineLookupEngine {
  if (!engine) engine = new MedicineLookupEngine();
  return engine;
}

export function resetMedicineLookupEngineForTests(): void {
  engine = null;
}
