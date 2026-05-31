import { Prisma } from '../../../generated/prisma/index.js';
import { logError, logInfo, logWarn } from '../../../shared/logger/logger.js';

const EVENT = 'ai.admin.diagnostics';

function enabled(): boolean {
  const v = process.env.AI_ADMIN_DIAGNOSTICS?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || process.env.NODE_ENV === 'development';
}

export function isAiAdminDiagnosticsEnabled(): boolean {
  return enabled();
}

export type AiAdminDiagnosticContext = {
  layer: 'route' | 'controller' | 'service' | 'repository' | 'prisma';
  route: string;
  method?: string;
  handler?: string;
  service?: string;
  operation?: string;
  requestPayload?: unknown;
};

function prismaDetails(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      prismaCode: error.code,
      meta: error.meta,
      clientVersion: error.clientVersion,
    };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      prismaCode: 'INITIALIZATION',
      errorCode: error.errorCode,
      clientVersion: error.clientVersion,
    };
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { prismaCode: 'VALIDATION' };
  }
  return undefined;
}

export function logAiAdminDiagnostic(
  phase: 'enter' | 'exit' | 'error',
  ctx: AiAdminDiagnosticContext,
  extra?: Record<string, unknown> & { error?: unknown },
): void {
  if (!enabled()) return;

  const payload = {
    event: EVENT,
    phase,
    ...ctx,
    ...extra,
    ...(extra?.error
      ? {
          errorName: extra.error instanceof Error ? extra.error.name : 'Error',
          errorMessage: extra.error instanceof Error ? extra.error.message : String(extra.error),
          errorStack: extra.error instanceof Error ? extra.error.stack : undefined,
          prisma: prismaDetails(extra.error),
        }
      : {}),
  };

  if (phase === 'error') {
    logError('AI admin diagnostic failure', extra?.error instanceof Error ? extra.error : undefined, payload);
    return;
  }
  logInfo('AI admin diagnostic', payload);
}

/** Logs missing env keys referenced by AI admin startup (non-secret names only). */
export async function withAiAdminDiagnostics<T>(
  ctx: AiAdminDiagnosticContext,
  fn: () => Promise<T>,
): Promise<T> {
  logAiAdminDiagnostic('enter', ctx);
  try {
    const result = await fn();
    logAiAdminDiagnostic('exit', ctx);
    return result;
  } catch (error) {
    logAiAdminDiagnostic('error', ctx, { error });
    throw error;
  }
}

export function logAiAdminEnvProbe(keys: string[]): void {
  if (!enabled()) return;
  const missing = keys.filter((k) => !process.env[k]?.trim());
  if (missing.length === 0) {
    logInfo('AI admin env probe ok', { event: EVENT, checked: keys.length });
    return;
  }
  logWarn('AI admin env probe — missing variables', {
    event: EVENT,
    missing,
  });
}
