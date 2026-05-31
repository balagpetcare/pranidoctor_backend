import { AiKnowledgeStatus } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import {
  buildGraphHints,
  detectEmergencyQuery,
  detectSymptomCodesFromQuery,
  GRAPH_EMERGENCY_SLUG_BOOST,
  GRAPH_SLUG_BOOST,
  MAX_GRAPH_SLUGS,
  type GraphHint,
} from './graph-expansion.logic.js';

export type GraphExpansionResult = {
  hints: GraphHint[];
  diseaseSlugs: string[];
  /** slug → fusion boost multiplier additive (0–0.25) */
  slugBoosts: Map<string, number>;
};

const EMERGENCY_FALLBACK_SLUGS = [
  'unknown-acute-collapse',
  'severe-bleeding',
  'acute-hs-crisis',
  'acute-bloat',
  'traumatic-injury',
];

export class GraphExpansionService {
  readonly name = 'GraphExpansionService';

  async expand(params: {
    query: string;
    expandedTerms: string[];
    emergencyProfile?: boolean;
  }): Promise<GraphExpansionResult> {
    const symptomCodes = detectSymptomCodesFromQuery(params.query, params.expandedTerms);
    const emergencyQuery =
      params.emergencyProfile || detectEmergencyQuery(params.query);

    if (symptomCodes.length === 0) {
      if (!emergencyQuery) {
        return { hints: [], diseaseSlugs: [], slugBoosts: new Map() };
      }

      const boost = GRAPH_EMERGENCY_SLUG_BOOST;
      const slugBoosts = new Map<string, number>();
      for (const slug of EMERGENCY_FALLBACK_SLUGS) {
        slugBoosts.set(slug, boost);
      }
      return {
        hints: EMERGENCY_FALLBACK_SLUGS.map((slug) => ({
          edgeType: 'EMERGENCY_FALLBACK',
          fromSlug: 'emergency',
          toSlug: slug,
          label: 'জরুরি',
        })),
        diseaseSlugs: [...EMERGENCY_FALLBACK_SLUGS],
        slugBoosts,
      };
    }

    const nodes = await getPrisma().aiSymptomNode.findMany({
      where: { code: { in: symptomCodes } },
      select: { id: true, code: true, labelBn: true },
    });

    if (nodes.length === 0) {
      return { hints: [], diseaseSlugs: [], slugBoosts: new Map() };
    }

    const links = await getPrisma().aiSymptomDiseaseLink.findMany({
      where: { symptomNodeId: { in: nodes.map((n) => n.id) } },
      include: {
        knowledgeEntry: { select: { slug: true, status: true, contentType: true } },
        symptomNode: { select: { code: true, labelBn: true } },
      },
    });

    const boost =
      emergencyQuery ? GRAPH_EMERGENCY_SLUG_BOOST : GRAPH_SLUG_BOOST;
    const slugBoosts = new Map<string, number>();
    const hintLinks: Array<{ symptomCode: string; diseaseSlug: string; labelBn: string }> = [];
    const diseaseSlugs: string[] = [];

    for (const link of links) {
      if (link.knowledgeEntry.status !== AiKnowledgeStatus.PUBLISHED) continue;
      const slug = link.knowledgeEntry.slug;
      if (!diseaseSlugs.includes(slug)) {
        diseaseSlugs.push(slug);
      }
      if (diseaseSlugs.length > MAX_GRAPH_SLUGS) break;

      slugBoosts.set(slug, Math.max(slugBoosts.get(slug) ?? 0, boost * (link.edgeWeight ?? 0.65)));
      hintLinks.push({
        symptomCode: link.symptomNode.code,
        diseaseSlug: slug,
        labelBn: link.symptomNode.labelBn,
      });
    }

    return {
      hints: buildGraphHints(hintLinks).slice(0, MAX_GRAPH_SLUGS),
      diseaseSlugs: diseaseSlugs.slice(0, MAX_GRAPH_SLUGS),
      slugBoosts,
    };
  }
}

let service: GraphExpansionService | null = null;

export function getGraphExpansionService(): GraphExpansionService {
  if (!service) service = new GraphExpansionService();
  return service;
}

export function resetGraphExpansionServiceForTests(): void {
  service = null;
}
