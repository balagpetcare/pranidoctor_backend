import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../../../generated/prisma/index.js';
import { AiMemoryKind } from '../../../../generated/prisma/index.js';
import { NotFoundError, ForbiddenError } from '../../../../shared/errors/http.errors.js';
import { getAiVeterinaryRepository } from '../../../ai-veterinary-core/repository/ai-veterinary.repository.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';

import { AI_DOCTOR_MEMORY_KEY_PREFIX } from '../ai-doctor.constants.js';
import type {
  AiDoctorCase,
  AiDoctorCaseState,
  CreateAiDoctorCaseInput,
  SymptomCompletenessScore,
  SymptomSnapshot,
} from '../ai-doctor.types.js';
import { computeSymptomCompleteness } from './symptom-intake.engine.js';

export function caseMemoryKey(caseId: string): string {
  return `${AI_DOCTOR_MEMORY_KEY_PREFIX}${caseId}`;
}

function emptySnapshot(): SymptomSnapshot {
  return { symptomCodes: [], freeTextSymptoms: [], normalizedTerms: [] };
}

function emptyCompleteness(): SymptomCompletenessScore {
  return {
    score: 0,
    requiredFieldsMet: false,
    missingFields: ['body_system', 'duration', 'severity'],
    redFlagScreened: false,
  };
}

export function buildNewCase(input: CreateAiDoctorCaseInput): AiDoctorCase {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId: input.userId,
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    ...(input.livestockId !== undefined ? { livestockId: input.livestockId } : {}),
    species: input.species,
    locale: input.locale ?? 'bn',
    state: 'CREATED',
    ...(input.symptomCheckSessionId !== undefined
      ? { symptomCheckSessionId: input.symptomCheckSessionId }
      : {}),
    symptomSnapshot: emptySnapshot(),
    completeness: emptyCompleteness(),
    differentials: [],
    escalationIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export class AiDoctorSessionEngine {
  readonly name = 'AiDoctorSessionEngine';

  async createCase(input: CreateAiDoctorCaseInput): Promise<AiDoctorCase> {
    const repo = getAiVeterinaryRepository();
    const aiCase = buildNewCase(input);
    const session = await repo.createSession(input.userId, input.locale ?? 'bn');
    aiCase.sessionId = session.id;
    aiCase.state = 'INTAKE';
    await this.persistCase(aiCase);
    return aiCase;
  }

  async loadCase(caseId: string, userId: string): Promise<AiDoctorCase> {
    const aiCase = await loadAiDoctorCase(caseId, userId);
    if (!aiCase) {
      throw new NotFoundError('AI_DOCTOR_CASE_NOT_FOUND', 'AI Doctor case not found');
    }
    if (aiCase.userId !== userId) {
      throw new ForbiddenError('AI_DOCTOR_CASE_ACCESS_DENIED', 'Case access denied');
    }
    return aiCase;
  }

  async updateCase(aiCase: AiDoctorCase): Promise<AiDoctorCase> {
    aiCase.updatedAt = new Date().toISOString();
    await this.persistCase(aiCase);
    return aiCase;
  }

  transitionState(aiCase: AiDoctorCase, state: AiDoctorCaseState): AiDoctorCase {
    return { ...aiCase, state, updatedAt: new Date().toISOString() };
  }

  applyIntake(
    aiCase: AiDoctorCase,
    snapshot: SymptomSnapshot,
    completeness: SymptomCompletenessScore,
  ): AiDoctorCase {
    return {
      ...aiCase,
      symptomSnapshot: snapshot,
      completeness,
      state: completeness.score >= 0.6 ? 'INTAKE' : 'AWAITING_CLARIFICATION',
      updatedAt: new Date().toISOString(),
    };
  }

  private async persistCase(aiCase: AiDoctorCase): Promise<void> {
    await persistAiDoctorCase(aiCase);
  }
}

export async function loadAiDoctorCase(caseId: string, userId: string): Promise<AiDoctorCase | null> {
  const repo = getAiVeterinaryRepository();
  const rows = await repo.listMemory(userId, AiMemoryKind.CASE_CONTEXT, caseMemoryKey(caseId));
  if (rows.length === 0) return null;
  return rows[0]!.valueJson as unknown as AiDoctorCase;
}

export async function persistAiDoctorCase(aiCase: AiDoctorCase): Promise<void> {
  const repo = getAiVeterinaryRepository();
  await repo.upsertMemory(
    omitUndefined({
      userId: aiCase.userId,
      kind: AiMemoryKind.CASE_CONTEXT,
      key: caseMemoryKey(aiCase.id),
      valueJson: aiCase as unknown as Prisma.InputJsonValue,
      sessionId: aiCase.sessionId,
    }),
  );
}

let engine: AiDoctorSessionEngine | null = null;

export function getAiDoctorSessionEngine(): AiDoctorSessionEngine {
  if (!engine) engine = new AiDoctorSessionEngine();
  return engine;
}

export function resetAiDoctorSessionEngineForTests(): void {
  engine = null;
}

export { computeSymptomCompleteness };
