import type { TreatmentWorkflowStatus } from '../../../generated/prisma/index.js';

const TRANSITIONS: Record<TreatmentWorkflowStatus, TreatmentWorkflowStatus[]> = {
  ASSIGNED: ['CONSULTATION_STARTED'],
  CONSULTATION_STARTED: ['DIAGNOSED'],
  DIAGNOSED: ['PRESCRIBED'],
  PRESCRIBED: ['FOLLOWUP_PENDING', 'CLOSED'],
  FOLLOWUP_PENDING: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(
  from: TreatmentWorkflowStatus,
  to: TreatmentWorkflowStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: TreatmentWorkflowStatus,
  to: TreatmentWorkflowStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
  }
}

export function expectedFromStates(to: TreatmentWorkflowStatus): TreatmentWorkflowStatus[] {
  return (Object.keys(TRANSITIONS) as TreatmentWorkflowStatus[]).filter((from) =>
    TRANSITIONS[from].includes(to),
  );
}

export function isMutableState(status: TreatmentWorkflowStatus): boolean {
  return status !== 'CLOSED';
}
