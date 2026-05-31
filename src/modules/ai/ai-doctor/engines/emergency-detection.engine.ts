import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { AiRiskBucket } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import {
  detectEmergencyIntent,
} from '../../knowledge-retrieval/grounding/medical-safety.service.js';
import { assessSymptomRisk } from '../../../ai-veterinary-core/safety/ai-safety.guardrails.js';

import type {
  AiDoctorLocale,
  CaseRiskAssessment,
  RedFlagItem,
  SymptomSnapshot,
  UrgencyTier,
} from '../ai-doctor.types.js';
import { buildRetrievalQuery } from './symptom-intake.engine.js';

function mapBucketToUrgency(bucket: 'LOW' | 'MEDIUM' | 'HIGH', emergency: boolean): UrgencyTier {
  if (emergency) return 'CRITICAL';
  if (bucket === 'HIGH') return 'HIGH';
  if (bucket === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function recommendationForTier(tier: UrgencyTier): { bn: string; en: string } {
  const table: Record<UrgencyTier, { bn: string; en: string }> = {
    CRITICAL: {
      bn: 'অবিলম্বে প্রাণী চিকিৎসকের সহায়তা নিন — সম্ভাব্য জরুরি অবস্থা।',
      en: 'Seek immediate veterinary care — possible emergency.',
    },
    HIGH: {
      bn: 'যত তাড়াতাড়ি সম্ভব চিকিৎসকের পরামর্শ নিন।',
      en: 'Contact a veterinarian as soon as possible.',
    },
    MEDIUM: {
      bn: 'লক্ষণ ২৪–৪৮ ঘণ্টার মধ্যে বজায় থাকলে চিকিৎসক দেখান।',
      en: 'See a veterinarian if symptoms persist 24–48 hours.',
    },
    LOW: {
      bn: 'পর্যবেক্ষণ রাখুন এবং পরিষ্কার পানি/যত্ন নিশ্চিত করুন।',
      en: 'Monitor the animal and ensure rest and clean water.',
    },
  };
  return table[tier];
}

export async function loadGraphRedFlags(params: {
  symptomCodes: string[];
  species: LivestockSpecies;
}): Promise<RedFlagItem[]> {
  if (params.symptomCodes.length === 0) return [];

  const prisma = getPrisma();
  const nodes = await prisma.aiSymptomNode.findMany({
    where: {
      code: { in: params.symptomCodes },
      species: { has: params.species },
      redFlag: true,
    },
  });

  return nodes.map((n) => ({
    code: n.code,
    labelBn: n.labelBn,
    labelEn: n.labelEn,
    source: 'graph' as const,
  }));
}

export function detectLexiconEmergency(snapshot: SymptomSnapshot, locale: AiDoctorLocale): boolean {
  const query = buildRetrievalQuery(snapshot, locale);
  return detectEmergencyIntent(query);
}

export async function assessCaseRisk(params: {
  snapshot: SymptomSnapshot;
  species: LivestockSpecies;
  locale: AiDoctorLocale;
  symptomLabels?: string[];
}): Promise<CaseRiskAssessment> {
  const graphRedFlags = await loadGraphRedFlags({
    symptomCodes: params.snapshot.symptomCodes,
    species: params.species,
  });

  const labels =
    params.symptomLabels ??
    [...params.snapshot.freeTextSymptoms, ...(params.snapshot.normalizedTerms ?? [])];

  const lexiconEmergency = detectLexiconEmergency(params.snapshot, params.locale);
  const risk = assessSymptomRisk(labels);

  const redFlags: RedFlagItem[] = [...graphRedFlags];
  if (lexiconEmergency && !redFlags.length) {
    redFlags.push({
      code: 'LEXICON_EMERGENCY',
      labelBn: 'জরুরি লক্ষণ শনাক্ত',
      labelEn: 'Emergency keywords detected',
      source: 'lexicon',
    });
  }

  const emergency = risk.emergency || lexiconEmergency || graphRedFlags.length > 0;
  const urgencyTier = mapBucketToUrgency(risk.bucket, emergency);
  const rec = recommendationForTier(urgencyTier);

  let triageBucket: AiRiskBucket = AiRiskBucket.LOW;
  if (emergency || urgencyTier === 'CRITICAL') triageBucket = AiRiskBucket.HIGH;
  else if (urgencyTier === 'HIGH') triageBucket = AiRiskBucket.HIGH;
  else if (urgencyTier === 'MEDIUM') triageBucket = AiRiskBucket.MEDIUM;

  return {
    urgencyTier,
    triageBucket,
    urgencyLevel: emergency ? 10 : risk.urgencyLevel,
    redFlags,
    recommendationBn: rec.bn,
    recommendationEn: rec.en,
    escalationRequired: emergency || urgencyTier === 'HIGH' || urgencyTier === 'CRITICAL',
    emergency,
  };
}

export function shouldSkipLlmForEmergency(risk: CaseRiskAssessment): boolean {
  return risk.urgencyTier === 'CRITICAL' || risk.emergency;
}

export class EmergencyDetectionEngine {
  readonly name = 'EmergencyDetectionEngine';

  assessCaseRisk = assessCaseRisk;
  loadGraphRedFlags = loadGraphRedFlags;
  shouldSkipLlm = shouldSkipLlmForEmergency;
  detectLexiconEmergency = detectLexiconEmergency;
}

let engine: EmergencyDetectionEngine | null = null;

export function getEmergencyDetectionEngine(): EmergencyDetectionEngine {
  if (!engine) engine = new EmergencyDetectionEngine();
  return engine;
}

export function resetEmergencyDetectionEngineForTests(): void {
  engine = null;
}
