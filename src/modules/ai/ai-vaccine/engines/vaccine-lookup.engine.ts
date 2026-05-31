import {
  AiKnowledgeContentType,
  AiKnowledgeStatus,
  type LivestockSpecies,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';

import { VACCINE_MAX_LOOKUP } from '../ai-vaccine.constants.js';
import type { VaccineMatch, VaccineReferenceCard } from '../ai-vaccine.types.js';
import {
  buildVaccineCitation,
  parseVaccineStructured,
  resolveEntityType,
  scoreVaccineQueryMatch,
  type PublishedVaccineEntry,
} from './vaccine-metadata.util.js';

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
}): PublishedVaccineEntry {
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
    entityType: resolveEntityType(row.metadataJson, row.slug),
    ...(row.source?.sourceKey ? { sourceKey: row.source.sourceKey } : {}),
  };
}

export async function loadVaccineBySlugs(slugs: string[]): Promise<PublishedVaccineEntry[]> {
  if (slugs.length === 0) return [];
  const rows = await getPrisma().aiKnowledgeEntry.findMany({
    where: {
      slug: { in: slugs },
      contentType: AiKnowledgeContentType.VACCINE,
      status: AiKnowledgeStatus.PUBLISHED,
    },
    include: { source: { select: { sourceKey: true } } },
  });
  return rows.map(toPublishedEntry);
}

export async function searchVaccines(params: {
  query: string;
  species?: LivestockSpecies;
  entityType?: string;
  limit?: number;
}): Promise<VaccineMatch[]> {
  const q = params.query.trim();
  if (!q) return [];

  const rows = await getPrisma().aiKnowledgeEntry.findMany({
    where: {
      contentType: AiKnowledgeContentType.VACCINE,
      status: AiKnowledgeStatus.PUBLISHED,
      ...(params.species ? { species: { has: params.species } } : {}),
    },
    include: { source: { select: { sourceKey: true } } },
    take: 120,
    orderBy: { updatedAt: 'desc' },
  });

  const scored = rows
    .map((row) => {
      const entry = toPublishedEntry(row);
      if (params.entityType && entry.entityType !== params.entityType) {
        return { entry, score: 0 };
      }
      return { entry, score: scoreVaccineQueryMatch(entry, q) };
    })
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit ?? VACCINE_MAX_LOOKUP);

  return scored.map(({ entry, score }) => {
    const structured = parseVaccineStructured(entry.metadataJson);
    return {
      entityId: entry.id,
      slug: entry.slug,
      titleBn: entry.titleBn,
      titleEn: entry.titleEn,
      entityType: entry.entityType,
      ...(structured.antigen !== undefined ? { antigen: structured.antigen } : {}),
      confidenceScore: score,
      citations: [buildVaccineCitation(entry)],
    };
  });
}

export function buildVaccineReferenceCard(entry: PublishedVaccineEntry): VaccineReferenceCard {
  const structured = parseVaccineStructured(entry.metadataJson);
  const summaryBn = entry.bodyBn.split('\n').slice(0, 4).join('\n').trim();
  const summaryEn = entry.bodyEn.split('\n').slice(0, 4).join('\n').trim();
  return {
    slug: entry.slug,
    titleBn: entry.titleBn,
    titleEn: entry.titleEn,
    ...(structured.antigen !== undefined ? { antigen: structured.antigen } : {}),
    ...(structured.route !== undefined ? { route: structured.route } : {}),
    ...(structured.doseMl !== undefined ? { doseMl: structured.doseMl } : {}),
    ...(structured.storageTempC !== undefined ? { storageTempC: structured.storageTempC } : {}),
    species: entry.species,
    summaryBn,
    summaryEn,
    citations: [buildVaccineCitation(entry)],
  };
}

export class VaccineLookupEngine {
  readonly name = 'VaccineLookupEngine';
  search = searchVaccines;
  loadBySlugs = loadVaccineBySlugs;
}

let engine: VaccineLookupEngine | null = null;

export function getVaccineLookupEngine(): VaccineLookupEngine {
  if (!engine) engine = new VaccineLookupEngine();
  return engine;
}

export function resetVaccineLookupEngineForTests(): void {
  engine = null;
}
