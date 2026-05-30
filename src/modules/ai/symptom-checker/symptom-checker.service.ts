import {
  AiRiskBucket,
  type LivestockSpecies,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { resolveAiResponseDisclaimer } from '../disclaimer/ai-disclaimer.resolver.js';
import { resolveOptionalEscalationDisclosure } from '../disclaimer/ai-escalation-disclosure.resolver.js';
import {
  attachComplianceToResponse,
  mapBucketToComplianceRisk,
} from '../compliance/ai-compliance.service.js';
import { symptomCheckEscalationTrigger } from '../../../legacy/web/lib/ai-escalation-disclosure/ai-escalation-disclosure.service.js';
import { assessSymptomRisk } from '../../ai-veterinary-core/safety/ai-safety.guardrails.js';
import { getAiSafetyService } from '../../ai-veterinary-core/safety/ai-safety.service.js';
import { ValidationError } from '../../../shared/errors/http.errors.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { getAiKnowledgeService } from '../knowledge/ai-knowledge.service.js';
import { getAiOrchestratorService } from '../orchestrator/ai-orchestrator.service.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

export interface SymptomCheckInput {
  userId: string;
  customerId?: string;
  livestockId?: string;
  species: LivestockSpecies;
  symptomCodes: string[];
  freeTextSymptoms?: string[];
  durationDays?: number;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  locale?: 'bn' | 'en';
  aiSessionId?: string;
}

export class SymptomCheckerService {
  readonly name = 'SymptomCheckerService';

  async getTaxonomy(species: LivestockSpecies) {
    const prisma = getPrisma();
    const nodes = await prisma.aiSymptomNode.findMany({
      where: { species: { has: species } },
      orderBy: [{ bodySystem: 'asc' }, { labelEn: 'asc' }],
    });

    const bySystem = new Map<string, typeof nodes>();
    for (const node of nodes) {
      const list = bySystem.get(node.bodySystem) ?? [];
      list.push(node);
      bySystem.set(node.bodySystem, list);
    }

    return {
      species,
      bodySystems: [...bySystem.entries()].map(([bodySystem, symptoms]) => ({
        bodySystem,
        symptoms: symptoms.map((s) => ({
          code: s.code,
          labelBn: s.labelBn,
          labelEn: s.labelEn,
          redFlag: s.redFlag,
        })),
      })),
    };
  }

  async runCheck(input: SymptomCheckInput) {
    const prisma = getPrisma();
    const locale = input.locale ?? 'bn';

    const nodes = await prisma.aiSymptomNode.findMany({
      where: {
        code: { in: input.symptomCodes },
        species: { has: input.species },
      },
      include: { diseaseLinks: { include: { knowledgeEntry: true } } },
    });

    if (nodes.length !== input.symptomCodes.length) {
      throw new ValidationError('INVALID_SYMPTOM_CODES', 'One or more symptom codes are invalid for this species');
    }

    if (input.freeTextSymptoms?.length) {
      const joined = input.freeTextSymptoms.join(' ');
      const refusal = getAiSafetyService().evaluateUserInput(joined, locale);
      if (refusal) {
        throw new ValidationError('UNSAFE_SYMPTOM_INPUT', refusal.content);
      }
    }

    const redFlags = nodes.filter((n) => n.redFlag).map((n) => ({
      code: n.code,
      labelBn: n.labelBn,
      labelEn: n.labelEn,
    }));

    const symptomLabels = [
      ...nodes.map((n) => (locale === 'bn' ? n.labelBn : n.labelEn)),
      ...(input.freeTextSymptoms ?? []),
    ];

    const risk = assessSymptomRisk(symptomLabels);

    let confidence = 0.5;
    if (nodes.length > 0) {
      confidence = Math.min(0.95, nodes.reduce((s, n) => s + n.weight, 0) / nodes.length);
    }
    if (input.severity === 'SEVERE') confidence = Math.min(0.99, confidence + 0.15);
    if (input.durationDays != null && input.durationDays > 3) confidence = Math.min(0.99, confidence + 0.05);
    if (redFlags.length > 0) confidence = Math.max(confidence, 0.85);

    const differentialMap = new Map<string, { titleBn: string; titleEn: string; weight: number }>();
    for (const node of nodes) {
      for (const link of node.diseaseLinks) {
        if (link.knowledgeEntry.status !== 'PUBLISHED') continue;
        const existing = differentialMap.get(link.knowledgeEntryId);
        const weight = (existing?.weight ?? 0) + link.edgeWeight * node.weight;
        differentialMap.set(link.knowledgeEntryId, {
          titleBn: link.knowledgeEntry.titleBn,
          titleEn: link.knowledgeEntry.titleEn,
          weight,
        });
      }
    }

    const differentials = [...differentialMap.entries()]
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 5)
      .map(([, v]) => ({
        title: locale === 'bn' ? v.titleBn : v.titleEn,
        confidence: Math.round(v.weight * 100) / 100,
        disclaimer:
          locale === 'bn'
            ? 'শুধুমাত্র শিক্ষামূলক — চিকিৎসক ছাড়া নিশ্চিত নয়'
            : 'Educational only — not confirmed without a veterinarian',
      }));

    if (differentials.length === 0 && symptomLabels.length > 0) {
      const rag = await getAiKnowledgeService().retrieveForRag({
        query: symptomLabels.join(' '),
        locale,
        species: input.species,
        limit: 3,
      });
      if (rag) {
        differentials.push({
          title: locale === 'bn' ? 'সম্ভাব্য সম্পর্কিত তথ্য' : 'Possibly related information',
          confidence: 0.4,
          disclaimer: rag.slice(0, 200),
        });
      }
    }

    const triageBucket = risk.bucket as AiRiskBucket;
    const urgencyLevel = risk.urgencyLevel;

    const session = await prisma.aiSymptomCheckSession.create({
      data: omitUndefined({
        userId: input.userId,
        customerId: input.customerId,
        livestockId: input.livestockId,
        species: input.species,
        symptomsJson: {
          codes: input.symptomCodes,
          freeText: input.freeTextSymptoms ?? [],
          durationDays: input.durationDays,
          severity: input.severity,
        },
        symptomCodes: input.symptomCodes,
        confidence,
        redFlagsJson: redFlags,
        differentialsJson: differentials,
        triageBucket,
        urgencyLevel,
        aiSessionId: input.aiSessionId,
      }),
    });

    await getAiAuditService().write(
      omitUndefined({
        userId: input.userId,
        sessionId: input.aiSessionId,
        action: redFlags.length > 0 ? 'TRIAGE_RED_FLAG' : 'SYMPTOM_CHECK_OK',
        detailJson: { sessionId: session.id, triageBucket, confidence },
      }),
    );

    const recommendation =
      locale === 'bn'
        ? risk.emergency
          ? 'অবিলম্বে প্রাণী চিকিৎসকের সহায়তা নিন — সম্ভাব্য জরুরি অবস্থা।'
          : risk.bucket === 'HIGH'
            ? 'যত তাড়াতাড়ি সম্ভব চিকিৎসকের পরামর্শ নিন।'
            : risk.bucket === 'MEDIUM'
              ? 'লক্ষণ ২৪–৪৮ ঘণ্টার মধ্যে বজায় থাকলে চিকিৎসক দেখান।'
              : 'পর্যবেক্ষণ রাখুন এবং পরিষ্কার পানি/যত্ন নিশ্চিত করুন।'
        : risk.emergency
          ? 'Seek immediate veterinary care — possible emergency.'
          : risk.bucket === 'HIGH'
            ? 'Contact a veterinarian as soon as possible.'
            : risk.bucket === 'MEDIUM'
              ? 'See a vet if symptoms persist 24–48 hours.'
              : 'Monitor the animal and ensure rest and clean water.';

    const escalationRequired = risk.bucket === 'HIGH' || risk.emergency;
    const base = {
      sessionId: session.id,
      confidence,
      redFlags,
      differentials,
      triageBucket,
      urgencyLevel,
      escalationRequired,
      emergency: risk.emergency,
      recommendation,
      disclaimer: await resolveAiResponseDisclaimer('advisory', locale),
    };
    const disclosure = await resolveOptionalEscalationDisclosure(
      symptomCheckEscalationTrigger({ escalationRequired, emergency: risk.emergency }),
      locale,
    );
    return attachComplianceToResponse(
      { ...base, ...disclosure },
      {
        userId: input.userId,
        ...(input.aiSessionId !== undefined ? { sessionId: input.aiSessionId } : {}),
        feature: 'symptom_check',
        riskLevel: mapBucketToComplianceRisk(triageBucket),
        emergency: risk.emergency,
        escalationRequired,
      },
    );
  }
}

let service: SymptomCheckerService | null = null;

export function getSymptomCheckerService(): SymptomCheckerService {
  if (!service) service = new SymptomCheckerService();
  return service;
}
