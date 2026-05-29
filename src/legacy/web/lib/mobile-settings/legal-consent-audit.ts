import { randomUUID } from 'node:crypto';

import type { LegalConsentType, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export type RecordLegalConsentInput = {
  userId: string;
  consentType: LegalConsentType;
  version: string;
  channel?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Append-only consent audit — never throws. */
export async function recordLegalConsentEvent(input: RecordLegalConsentInput): Promise<void> {
  try {
    await prisma.legalConsentEvent.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        consentType: input.consentType,
        version: input.version,
        channel: input.channel ?? 'MOBILE',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[legal-consent] audit write failed user=${input.userId} type=${input.consentType} ${msg}`,
    );
  }
}

export function recordLegalConsentFireAndForget(input: RecordLegalConsentInput): void {
  void recordLegalConsentEvent(input);
}

export type AdminLegalConsentListQuery = {
  consentType?: LegalConsentType;
  userId?: string;
  limit?: number;
  offset?: number;
};

export async function listLegalConsentEvents(query: AdminLegalConsentListQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const where: Prisma.LegalConsentEventWhereInput = {};
  if (query.consentType) where.consentType = query.consentType;
  if (query.userId) where.userId = query.userId;

  const [items, total] = await Promise.all([
    prisma.legalConsentEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userId: true,
        consentType: true,
        version: true,
        channel: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
    prisma.legalConsentEvent.count({ where }),
  ]);

  return {
    items: items.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  };
}
