import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../../../generated/prisma/index.js';
import { AiMemoryKind } from '../../../../generated/prisma/index.js';
import { ForbiddenError, NotFoundError } from '../../../../shared/errors/http.errors.js';
import { getAiVeterinaryRepository } from '../../../ai-veterinary-core/repository/ai-veterinary.repository.js';

import { PRESCRIPTION_MEMORY_KEY_PREFIX } from '../ai-prescription.constants.js';
import type {
  AiPrescriptionSession,
  CreatePrescriptionSessionInput,
  PrescriptionAccessMode,
} from '../ai-prescription.types.js';

export function sessionMemoryKey(sessionId: string): string {
  return `${PRESCRIPTION_MEMORY_KEY_PREFIX}${sessionId}`;
}

export function buildNewPrescriptionSession(input: CreatePrescriptionSessionInput): AiPrescriptionSession {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId: input.userId,
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    mode: input.mode ?? 'FARMER_REFERENCE',
    species: input.species,
    locale: input.locale ?? 'bn',
    state: 'CREATED',
    pregnancy: input.pregnancy ?? false,
    lactating: input.lactating ?? false,
    ...(input.ageDays !== undefined ? { ageDays: input.ageDays } : {}),
    ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
    drugSlugs: [],
    vaccineSlugs: [],
    ...(input.doctorCaseId !== undefined ? { doctorCaseId: input.doctorCaseId } : {}),
    escalationIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadPrescriptionSession(
  sessionId: string,
  userId: string,
): Promise<AiPrescriptionSession | null> {
  const repo = getAiVeterinaryRepository();
  const rows = await repo.listMemory(userId, AiMemoryKind.CASE_CONTEXT, sessionMemoryKey(sessionId));
  if (rows.length === 0) return null;
  return rows[0]!.valueJson as unknown as AiPrescriptionSession;
}

export async function persistPrescriptionSession(session: AiPrescriptionSession): Promise<void> {
  const repo = getAiVeterinaryRepository();
  await repo.upsertMemory({
    userId: session.userId,
    kind: AiMemoryKind.CASE_CONTEXT,
    key: sessionMemoryKey(session.id),
    valueJson: session as unknown as Prisma.InputJsonValue,
  });
}

export class PrescriptionSessionEngine {
  readonly name = 'PrescriptionSessionEngine';

  async createSession(input: CreatePrescriptionSessionInput): Promise<AiPrescriptionSession> {
    const repo = getAiVeterinaryRepository();
    const session = buildNewPrescriptionSession(input);
    const chatSession = await repo.createSession(input.userId, input.locale ?? 'bn');
    session.sessionId = chatSession.id;
    session.state = 'INTAKE';
    await persistPrescriptionSession(session);
    return session;
  }

  async loadSession(sessionId: string, userId: string): Promise<AiPrescriptionSession> {
    const session = await loadPrescriptionSession(sessionId, userId);
    if (!session) {
      throw new NotFoundError('PRESCRIPTION_SESSION_NOT_FOUND', 'Prescription session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenError('PRESCRIPTION_SESSION_ACCESS_DENIED', 'Session access denied');
    }
    return session;
  }

  async updateSession(session: AiPrescriptionSession): Promise<AiPrescriptionSession> {
    session.updatedAt = new Date().toISOString();
    await persistPrescriptionSession(session);
    return session;
  }

  transitionState(session: AiPrescriptionSession, state: AiPrescriptionSession['state']): AiPrescriptionSession {
    return { ...session, state, updatedAt: new Date().toISOString() };
  }

  setMode(session: AiPrescriptionSession, mode: PrescriptionAccessMode): AiPrescriptionSession {
    return { ...session, mode, updatedAt: new Date().toISOString() };
  }
}

let engine: PrescriptionSessionEngine | null = null;

export function getPrescriptionSessionEngine(): PrescriptionSessionEngine {
  if (!engine) engine = new PrescriptionSessionEngine();
  return engine;
}

export function resetPrescriptionSessionEngineForTests(): void {
  engine = null;
}
