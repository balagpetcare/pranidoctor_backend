import { describe, expect, it } from 'vitest';

import {
  canTransition,
  expectedFromStates,
  isMutableState,
} from './workflow.transitions.js';

describe('workflow.transitions', () => {
  it('allows assigned to consultation_started', () => {
    expect(canTransition('ASSIGNED', 'CONSULTATION_STARTED')).toBe(true);
  });

  it('allows prescribed to closed or followup_pending', () => {
    expect(canTransition('PRESCRIBED', 'CLOSED')).toBe(true);
    expect(canTransition('PRESCRIBED', 'FOLLOWUP_PENDING')).toBe(true);
  });

  it('blocks closed transitions', () => {
    expect(isMutableState('CLOSED')).toBe(false);
    expect(canTransition('CLOSED', 'ASSIGNED')).toBe(false);
  });

  it('lists expected predecessor states', () => {
    expect(expectedFromStates('DIAGNOSED')).toEqual(['CONSULTATION_STARTED']);
  });
});
