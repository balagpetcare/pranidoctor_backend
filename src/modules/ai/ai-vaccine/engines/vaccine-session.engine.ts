import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../../../generated/prisma/index.js';
import { AiMemoryKind } from '../../../../generated/prisma/index.js';
import { ForbiddenError, NotFoundError } from '../../../../shared/errors/http.errors.js';
import { getAiVeterinaryRepository } from '../../../ai-veterinary-core/repository/ai-veterinary.repository.js';

import { VACCINE_MEMORY_KEY_PREFIX } from '../ai-vaccine.constants.js';
import type { AiVaccineSession, CreateVaccineSessionInput } from '../ai-vaccine.types.js';

export function sessionMemoryKey(sessionId: string): string {
  return `${VACCINE_MEMORY_KEY_PREFIX}${sessionId}`;
}

export function buildNewVaccineSession(input: CreateVaccineSessionInput): AiVaccineSession {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId: input.userId,
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    mode: input.mode ?? 'FARMER_GUIDANCE',
    species: input.species,
    locale: input.locale ?? 'bn',
    state: 'CREATED',
    pregnancy: input.pregnancy ?? false,
    ...(input.livestockId !== undefined ? { livestockId: input.livestockId } : {}),
    ...(input.ageDays !== undefined ? { ageDays: input.ageDays } : {}),
    vaccineSlugs: [],
    medicineSlugs: [],
    escalationIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadVaccineSession(
  sessionId: string,
  userId: string,
): Promise<AiVaccineSession | null> {
  const repo = getAiVeterinaryRepository();
  const rows = await repo.listMemory(userId, AiMemoryKind.CASE_CONTEXT, sessionMemoryKey(sessionId));
  if (rows.length === 0) return null;
  return rows[0]!.valueJson as unknown as AiVaccineSession;
}

export async function persistVaccineSession(session: AiVaccineSession): Promise<void> {
  const repo = getAiVeterinaryRepository();
  await repo.upsertMemory({
    userId: session.userId,
    kind: AiMemoryKind.CASE_CONTEXT,
    key: sessionMemoryKey(session.id),
    valueJson: session as unknown as Prisma.InputJsonValue,
  });
}

export class VaccineSessionEngine {
  readonly name = 'VaccineSessionEngine';

  async createSession(input: CreateVaccineSessionInput): Promise<AiVaccineSession> {
    const repo = getAiVeterinaryRepository();
    const session = buildNewVaccineSession(input);
    const chatSession = await repo.createSession(input.userId, input.locale ?? 'bn');
    session.sessionId = chatSession.id;
    session.state = 'INTAKE';
    await persistVaccineSession(session);
    return session;
  }

  async loadSession(sessionId: string, userId: string): Promise<AiVaccineSession> {
    const session = await loadVaccineSession(sessionId, userId);
    if (!session) {
      throw new NotFoundError('VACCINE_SESSION_NOT_FOUND', 'Vaccine session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenError('VACCINE_SESSION_ACCESS_DENIED', 'Session access denied');
    }
    return session;
  }

  async updateSession(session: AiVaccineSession): Promise<AiVaccineSession> {
    session.updatedAt = new Date().toISOString();
    await persistVaccineSession(session);
    return session;
  }

  transitionState(session: AiVaccineSession, state: AiVaccineSession['state']): AiVaccineSession {
    return { ...session, state, updatedAt: new Date().toISOString() };
  }
}

let engine: VaccineSessionEngine | null = null;

export function getVaccineSessionEngine(): VaccineSessionEngine {
  if (!engine) engine = new VaccineSessionEngine();
  return engine;
}

export function resetVaccineSessionEngineForTests(): void {
  engine = null;
}
