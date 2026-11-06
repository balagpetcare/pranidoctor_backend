import { describe, expect, it } from 'vitest';

import {
  buildChecklist,
  isTypeAllowedFor,
  outstandingRequired,
  stateOf,
} from './partner-documents.rules.js';

describe('partner documents', () => {
  it('picks the best state among uploads', () => {
    expect(stateOf([])).toBe('MISSING');
    expect(stateOf([{ type: 'NID_FRONT', reviewStatus: 'REJECTED' }])).toBe('REJECTED');
    expect(
      stateOf([
        { type: 'NID_FRONT', reviewStatus: 'REJECTED' },
        { type: 'NID_FRONT', reviewStatus: 'PENDING_REVIEW' },
      ]),
    ).toBe('PENDING_REVIEW');
    expect(stateOf([{ type: 'NID_FRONT', reviewStatus: 'APPROVED' }])).toBe('APPROVED');
  });

  it('lists outstanding required docs and allowed types per role', () => {
    const list = buildChecklist('DOCTOR', [{ type: 'NID_FRONT', reviewStatus: 'APPROVED' }]);
    const missing = outstandingRequired(list).map((i) => i.type);
    expect(missing).toContain('BVC_CERTIFICATE');
    expect(missing).not.toContain('NID_FRONT');
    expect(missing).not.toContain('SIGNATURE');
    expect(isTypeAllowedFor('HEALTH_WORKER', 'BVC_CERTIFICATE')).toBe(false);
    expect(isTypeAllowedFor('AI_TECHNICIAN', 'AI_CERTIFICATE')).toBe(true);
  });
});
