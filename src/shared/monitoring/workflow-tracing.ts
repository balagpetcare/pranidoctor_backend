import { logInfo, logWarn } from '../logger/logger.js';
import { sanitizeObject } from '../logger/sanitizer.js';
import { getRequestContext } from '../context/request-context.js';

export type WorkflowName =
  | 'appointment'
  | 'doctor_consultation'
  | 'livestock'
  | 'ai'
  | 'authentication';

export type WorkflowOutcome = 'started' | 'completed' | 'failed' | 'skipped';

export type WorkflowTraceInput = {
  workflow: WorkflowName;
  step: string;
  outcome?: WorkflowOutcome;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Lightweight workflow tracing via structured logs — no external trace backend required.
 * Correlates with requestId/traceId from ALS when invoked inside an HTTP handler.
 */
export function traceWorkflow(input: WorkflowTraceInput): void {
  const ctx = getRequestContext();
  const payload = sanitizeObject({
    event: 'workflow.trace',
    workflow: input.workflow,
    step: input.step,
    outcome: input.outcome ?? 'completed',
    ...(input.resourceType ? { resourceType: input.resourceType } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx?.traceId ? { traceId: ctx.traceId } : {}),
    ...(ctx?.spanId ? { spanId: ctx.spanId } : {}),
    ...(ctx?.userId ? { userId: ctx.userId } : {}),
    ...(input.metadata ?? {}),
  }) as Record<string, unknown>;

  if (input.outcome === 'failed') {
    logWarn('Workflow trace', payload);
  } else {
    logInfo('Workflow trace', payload);
  }
}
