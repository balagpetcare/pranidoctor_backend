import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { detectMedicalIntent } from '../../knowledge-retrieval/grounding/medical-safety.service.js';
import type { KnowledgeContextPack } from '../../knowledge-retrieval/knowledge-retrieval.types.js';

import { AI_DOCTOR_MAX_DIFFERENTIALS } from '../ai-doctor.constants.js';
import type { AiDoctorLocale, GroundedDifferential } from '../ai-doctor.types.js';

type GraphDifferentialRow = {
  knowledgeEntryId: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  weight: number;
  evidenceLevel: string;
  supportingSymptoms: string[];
};

export async function loadGraphDifferentials(params: {
  symptomCodes: string[];
  species: LivestockSpecies;
}): Promise<GraphDifferentialRow[]> {
  if (params.symptomCodes.length === 0) return [];

  const prisma = getPrisma();
  const nodes = await prisma.aiSymptomNode.findMany({
    where: {
      code: { in: params.symptomCodes },
      species: { has: params.species },
    },
    include: {
      diseaseLinks: {
        include: {
          knowledgeEntry: { select: { id: true, slug: true, titleBn: true, titleEn: true, status: true } },
        },
      },
    },
  });

  const map = new Map<string, GraphDifferentialRow>();
  for (const node of nodes) {
    for (const link of node.diseaseLinks) {
      if (link.knowledgeEntry.status !== 'PUBLISHED') continue;
      const slug = link.knowledgeEntry.slug;
      const existing = map.get(link.knowledgeEntryId);
      const weight = (existing?.weight ?? 0) + link.edgeWeight * node.weight;
      const symptoms = existing?.supportingSymptoms ?? [];
      if (!symptoms.includes(node.code)) symptoms.push(node.code);
      map.set(link.knowledgeEntryId, {
        knowledgeEntryId: link.knowledgeEntryId,
        slug,
        titleBn: link.knowledgeEntry.titleBn,
        titleEn: link.knowledgeEntry.titleEn,
        weight,
        evidenceLevel: 'L2',
        supportingSymptoms: symptoms,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

export function graphRowToDifferential(row: GraphDifferentialRow, rank: number): GroundedDifferential {
  return {
    slug: row.slug,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    rank,
    confidenceScore: Math.min(0.95, Math.round(row.weight * 100) / 100),
    evidenceLevel: row.evidenceLevel,
    supportingSymptoms: row.supportingSymptoms,
    citations: [`[${row.slug}]`],
    source: 'graph',
  };
}

export function packChunksToDifferentials(pack: KnowledgeContextPack): GroundedDifferential[] {
  const diseaseChunks = pack.chunks.filter((c) => c.contentType === 'DISEASE');

  return diseaseChunks.slice(0, AI_DOCTOR_MAX_DIFFERENTIALS).map((chunk, index) => ({
    slug: chunk.slug,
    titleBn: chunk.title,
    titleEn: chunk.title,
    rank: index + 1,
    confidenceScore: chunk.confidenceScore,
    evidenceLevel: chunk.evidenceLevel,
    supportingSymptoms: [],
    citations: chunk.inlineCitation.trim() ? [chunk.inlineCitation] : [`[${chunk.slug}]`],
    source: 'rag' as const,
  }));
}

export function fuseDifferentials(params: {
  graphRows: GraphDifferentialRow[];
  pack: KnowledgeContextPack;
  locale: AiDoctorLocale;
}): GroundedDifferential[] {
  const bySlug = new Map<string, GroundedDifferential>();

  for (const row of params.graphRows) {
    bySlug.set(row.slug, graphRowToDifferential(row, 0));
  }

  for (const ragDiff of packChunksToDifferentials(params.pack)) {
    const existing = bySlug.get(ragDiff.slug);
    if (existing) {
      bySlug.set(ragDiff.slug, {
        ...existing,
        confidenceScore: Math.min(
          0.99,
          (existing.confidenceScore + ragDiff.confidenceScore) / 2 + 0.1,
        ),
        citations: [...new Set([...existing.citations, ...ragDiff.citations])],
        source: 'fused',
      });
    } else {
      bySlug.set(ragDiff.slug, ragDiff);
    }
  }

  return [...bySlug.values()]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, AI_DOCTOR_MAX_DIFFERENTIALS)
    .map((d, i) => ({ ...d, rank: i + 1 }));
}

export function allDifferentialsHaveCitations(differentials: GroundedDifferential[]): boolean {
  if (differentials.length === 0) return false;
  return differentials.every((d) => d.citations.some((c) => c.trim().length > 0));
}

export function formatDifferentialSummary(
  differentials: GroundedDifferential[],
  locale: AiDoctorLocale,
): string {
  if (differentials.length === 0) {
    return locale === 'bn'
      ? 'পর্যাপ্ত যাচাইকৃত তথ্য পাওয়া যায়নি।'
      : 'Insufficient verified information available.';
  }

  const header =
    locale === 'bn'
      ? 'সম্ভাব্য কারণগুলো (শিক্ষামূলক — চিকিৎসক ছাড়া নিশ্চিত নয়):'
      : 'Possible causes (educational — not confirmed without a veterinarian):';

  const lines = differentials.map((d, i) => {
    const title = locale === 'bn' ? d.titleBn : d.titleEn;
    const cites = d.citations.join(' ');
    return `${i + 1}. ${title} ${cites}`;
  });

  return [header, ...lines].join('\n');
}

export function isTreatmentIntentQuery(query: string): boolean {
  return detectMedicalIntent(query) && /\b(treatment|dose|antibiotic|medicine|চিকিৎসা|ওষুধ|মাত্রা)\b/iu.test(query);
}

export class DifferentialDiagnosisEngine {
  readonly name = 'DifferentialDiagnosisEngine';

  loadGraphDifferentials = loadGraphDifferentials;
  fuseDifferentials = fuseDifferentials;
  allHaveCitations = allDifferentialsHaveCitations;
  formatSummary = formatDifferentialSummary;
  isTreatmentIntent = isTreatmentIntentQuery;
}

let engine: DifferentialDiagnosisEngine | null = null;

export function getDifferentialDiagnosisEngine(): DifferentialDiagnosisEngine {
  if (!engine) engine = new DifferentialDiagnosisEngine();
  return engine;
}

export function resetDifferentialDiagnosisEngineForTests(): void {
  engine = null;
}

export type { GraphDifferentialRow };
