import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { ValidationError } from '../../../../shared/errors/http.errors.js';
import { getAiSafetyService } from '../../../ai-veterinary-core/safety/ai-safety.service.js';
import { normalizeQueryForRetrieval } from '../../knowledge-retrieval/query/query-normalizer.service.js';

import {
  AI_DOCTOR_COMPLETENESS_DEGRADED_THRESHOLD,
  AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD,
} from '../ai-doctor.constants.js';
import type {
  AiDoctorLocale,
  ClarificationQuestion,
  SymptomCompletenessScore,
  SymptomSnapshot,
  SymptomSeverity,
} from '../ai-doctor.types.js';

const CLARIFICATION_TEMPLATES: Record<string, { bn: string; en: string }> = {
  duration: {
    bn: 'লক্ষণগুলো কত দিন ধরে দেখা যাচ্ছে?',
    en: 'How many days have you noticed these symptoms?',
  },
  severity: {
    bn: 'লক্ষণগুলো কতটা গুরুতর — হালকা, মাঝারি, নাকি গুরুতর?',
    en: 'How severe are the symptoms — mild, moderate, or severe?',
  },
  body_system: {
    bn: 'আরও লক্ষণ বেছে নিন অথবা বিস্তারিত বর্ণনা করুন।',
    en: 'Please select more symptoms or describe what you observe.',
  },
  progression: {
    bn: 'লক্ষণগুলো কি খারাপ হচ্ছে, ভালো হচ্ছে, নাকি একই আছে?',
    en: 'Are the symptoms getting worse, better, or staying the same?',
  },
};

export function computeSymptomCompleteness(snapshot: SymptomSnapshot): SymptomCompletenessScore {
  const missingFields: SymptomCompletenessScore['missingFields'] = [];
  let score = 0;

  const hasStructured = snapshot.symptomCodes.length > 0;
  const hasFreeText = snapshot.freeTextSymptoms.length > 0;

  if (hasStructured) score += 0.35;
  else missingFields.push('body_system');

  if (hasFreeText) score += 0.2;

  if (snapshot.durationDays != null) score += 0.2;
  else missingFields.push('duration');

  if (snapshot.severity) score += 0.15;
  else missingFields.push('severity');

  if (hasStructured && hasFreeText) score += 0.1;

  return {
    score: Math.min(1, Math.round(score * 100) / 100),
    requiredFieldsMet: hasStructured || hasFreeText,
    missingFields,
    redFlagScreened: false,
  };
}

export function buildClarificationPlan(
  completeness: SymptomCompletenessScore,
  locale: AiDoctorLocale,
): ClarificationQuestion[] {
  if (completeness.score >= AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD) return [];

  return completeness.missingFields.map((field) => {
    const template = CLARIFICATION_TEMPLATES[field] ?? CLARIFICATION_TEMPLATES.body_system!;
    return {
      field,
      questionBn: template.bn,
      questionEn: template.en,
      ...(locale === 'bn' ? {} : {}),
    };
  });
}

export function meetsLlmCompletenessGate(completeness: SymptomCompletenessScore): boolean {
  return (
    completeness.requiredFieldsMet &&
    completeness.score >= AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD
  );
}

export function meetsDegradedCompletenessGate(completeness: SymptomCompletenessScore): boolean {
  return (
    completeness.requiredFieldsMet &&
    completeness.score >= AI_DOCTOR_COMPLETENESS_DEGRADED_THRESHOLD
  );
}

export function assertIntakeHasSymptoms(snapshot: SymptomSnapshot): void {
  if (snapshot.symptomCodes.length === 0 && snapshot.freeTextSymptoms.length === 0) {
    throw new ValidationError(
      'SYMPTOM_REQUIRED',
      'At least one structured symptom or free-text description is required',
    );
  }
}

export async function validateSymptomCodes(
  codes: string[],
  species: LivestockSpecies,
): Promise<void> {
  if (codes.length === 0) return;
  const prisma = getPrisma();
  const nodes = await prisma.aiSymptomNode.findMany({
    where: { code: { in: codes }, species: { has: species } },
    select: { code: true },
  });
  if (nodes.length !== codes.length) {
    throw new ValidationError(
      'INVALID_SYMPTOM_CODES',
      'One or more symptom codes are invalid for this species',
    );
  }
}

export function validateFreeTextSymptoms(
  freeText: string[] | undefined,
  locale: AiDoctorLocale,
): void {
  if (!freeText?.length) return;
  const joined = freeText.join(' ');
  const refusal = getAiSafetyService().evaluateUserInput(joined, locale);
  if (refusal) {
    throw new ValidationError('UNSAFE_SYMPTOM_INPUT', refusal.content);
  }
}

export function buildSymptomSnapshot(params: {
  symptomCodes: string[];
  freeTextSymptoms?: string[];
  durationDays?: number;
  severity?: SymptomSeverity;
  locale: AiDoctorLocale;
}): SymptomSnapshot {
  const freeText = params.freeTextSymptoms ?? [];
  const normalizedTerms: string[] = [];

  for (const text of freeText) {
    const normalized = normalizeQueryForRetrieval({ query: text, locale: params.locale });
    if (normalized.colloquialExpanded) {
      normalizedTerms.push(normalized.text);
    }
  }

  return {
    symptomCodes: params.symptomCodes,
    freeTextSymptoms: freeText,
    ...(params.durationDays !== undefined ? { durationDays: params.durationDays } : {}),
    ...(params.severity !== undefined ? { severity: params.severity } : {}),
    normalizedTerms,
  };
}

export function buildRetrievalQuery(snapshot: SymptomSnapshot, locale: AiDoctorLocale): string {
  const parts = [
    ...snapshot.normalizedTerms ?? [],
    ...snapshot.freeTextSymptoms,
    ...snapshot.symptomCodes,
  ];
  if (parts.length === 0) return locale === 'bn' ? 'পশুর লক্ষণ' : 'livestock symptoms';
  return parts.join(' ');
}

export class SymptomIntakeEngine {
  readonly name = 'SymptomIntakeEngine';

  computeCompleteness = computeSymptomCompleteness;
  buildClarificationPlan = buildClarificationPlan;
  validateSymptomCodes = validateSymptomCodes;
  validateFreeTextSymptoms = validateFreeTextSymptoms;
  buildSymptomSnapshot = buildSymptomSnapshot;
  buildRetrievalQuery = buildRetrievalQuery;
  meetsLlmGate = meetsLlmCompletenessGate;
  meetsDegradedGate = meetsDegradedCompletenessGate;
}

let engine: SymptomIntakeEngine | null = null;

export function getSymptomIntakeEngine(): SymptomIntakeEngine {
  if (!engine) engine = new SymptomIntakeEngine();
  return engine;
}

export function resetSymptomIntakeEngineForTests(): void {
  engine = null;
}
