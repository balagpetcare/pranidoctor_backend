import { randomUUID } from 'node:crypto';

import type { AuthAuditAction, Prisma, UserRole } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import type { AuthChannel } from './identity-core.js';

export type RecordAuthAuditInput = {
  action: AuthAuditAction;
  channel: AuthChannel | string;
  userId?: string | null;
  role?: UserRole | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Extract client IP / UA from a Fetch API Request (compat routes). */
export function authRequestContext(request?: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  if (!request) {
    return {};
  }
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress =
    forwarded?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined;
  const userAgent = request.headers.get('user-agent') ?? undefined;
  return {
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
  };
}

/**
 * Persists an auth audit row. Never throws — failures are logged only.
 */
export async function recordAuthAudit(input: RecordAuthAuditInput): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.authAuditEvent.create({
      data: {
        id: randomUUID(),
        action: input.action,
        channel: input.channel,
        userId: input.userId ?? null,
        role: input.role ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[pranidoctor][auth-audit] write failed action=${input.action} channel=${input.channel} ${msg}`);
  }
}

/** Non-blocking audit write for hot auth paths. */
export function recordAuthAuditFireAndForget(input: RecordAuthAuditInput): void {
  void recordAuthAudit(input);
}
