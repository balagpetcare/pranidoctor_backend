import { logError, logInfo, logWarn } from '../logger/logger.js';
import { sanitizeObject } from '../logger/sanitizer.js';
import { getRequestContext } from '../context/request-context.js';

export type LogCategory =
  | 'http.request'
  | 'http.error'
  | 'audit'
  | 'security'
  | 'ai.execution'
  | 'queue.job'
  | 'workflow.trace';

function withCorrelation(data: Record<string, unknown>): Record<string, unknown> {
  const ctx = getRequestContext();
  return sanitizeObject({
    ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx?.traceId ? { traceId: ctx.traceId } : {}),
    ...(ctx?.spanId ? { spanId: ctx.spanId } : {}),
    ...(ctx?.userId ? { userId: ctx.userId } : {}),
    ...data,
  }) as Record<string, unknown>;
}

export function logAuditEvent(
  action: string,
  data?: Record<string, unknown>,
): void {
  logInfo('Audit event', withCorrelation({ event: 'audit', action, ...data }));
}

export function logSecurityEvent(
  event: string,
  data?: Record<string, unknown>,
  severity: 'info' | 'warn' | 'error' = 'warn',
): void {
  const payload = withCorrelation({ event: 'security', securityEvent: event, ...data });
  if (severity === 'error') {
    logError('Security event', undefined, payload);
  } else if (severity === 'warn') {
    logWarn('Security event', payload);
  } else {
    logInfo('Security event', payload);
  }
}

export function logAiExecution(
  step: string,
  data?: Record<string, unknown>,
): void {
  logInfo('AI execution', withCorrelation({ event: 'ai.execution', step, ...data }));
}

export function logBackgroundJob(
  phase: 'started' | 'completed' | 'failed' | 'retry',
  data: Record<string, unknown>,
): void {
  const level = phase === 'failed' ? 'error' : 'info';
  const payload = withCorrelation({ event: 'queue.job', phase, ...data });
  if (level === 'error') {
    logError('Background job', undefined, payload);
  } else {
    logInfo('Background job', payload);
  }
}
