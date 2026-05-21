import { describe, expect, it } from 'vitest';

import { mapAggregate, mapDiagnosis, mapNote } from './treatment.mapper.js';

describe('treatment.mapper', () => {
  it('maps diagnosis dto', () => {
    const dto = mapDiagnosis({
      id: 'tc1',
      status: 'FINALIZED',
      chiefComplaint: 'Fever',
      symptoms: 'High temp',
      diagnosis: 'Infection',
      procedures: null,
      treatmentNotes: null,
      recordedAt: new Date('2026-05-21T10:00:00.000Z'),
      updatedAt: new Date('2026-05-21T10:00:00.000Z'),
    } as never);

    expect(dto.diagnosis).toBe('Infection');
  });

  it('maps aggregate shell', () => {
    const aggregate = mapAggregate({
      caseId: 'case1',
      workflow: {
        id: 'wf1',
        status: 'ASSIGNED',
        closedAt: null,
      } as never,
      consultations: [],
      diagnosis: null,
      prescriptions: [],
      followups: [],
    });

    expect(aggregate.workflowStatus).toBe('ASSIGNED');
    expect(aggregate.caseId).toBe('case1');
  });

  it('maps note dto', () => {
    const note = mapNote({
      id: 'n1',
      noteType: 'PRIVATE',
      content: 'Internal note',
      authorDoctorId: 'doc1',
      createdAt: new Date('2026-05-21T10:00:00.000Z'),
    } as never);

    expect(note.noteType).toBe('PRIVATE');
  });
});
