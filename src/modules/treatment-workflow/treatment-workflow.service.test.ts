import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const create = vi.fn();

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    treatmentWorkflow: { findUnique, create },
    treatmentConsultation: { findMany: vi.fn().mockResolvedValue([]) },
    treatmentCase: { findUnique: vi.fn().mockResolvedValue(null) },
    prescription: { findMany: vi.fn().mockResolvedValue([]) },
    treatmentFollowup: { findMany: vi.fn().mockResolvedValue([]) },
  }),
}));

vi.mock('./guards/treatment-access.guard.js', () => ({
  assertAssignedDoctorAccess: vi.fn().mockResolvedValue({
    ok: 'ALLOWED',
    doctorProfileId: 'doc1',
    animalId: 'animal1',
  }),
  appendTreatmentAudit: vi.fn(),
  resolveDoctorProfileId: vi.fn(),
  mapAccessError: vi.fn(),
}));

import { TreatmentWorkflowService } from './treatment-workflow.service.js';

describe('treatment-workflow.service consultation', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  it('rejects consultation when workflow is closed', async () => {
    findUnique.mockResolvedValue({
      id: 'wf1',
      serviceRequestId: 'case1',
      doctorId: 'doc1',
      status: 'CLOSED',
      treatmentCaseId: null,
    });

    const service = new TreatmentWorkflowService();
    const result = await service.startConsultation('user1', 'case1', {
      observations: 'Patient alert',
    });

    expect(result.ok).toBe('CLOSED');
  });
});

describe('treatment-workflow.service diagnosis', () => {
  it('rejects diagnosis from assigned state', async () => {
    findUnique.mockResolvedValue({
      id: 'wf1',
      serviceRequestId: 'case1',
      doctorId: 'doc1',
      status: 'ASSIGNED',
      treatmentCaseId: null,
    });

    const service = new TreatmentWorkflowService();
    const result = await service.recordDiagnosis('user1', 'case1', {
      diagnosis: 'Mastitis',
    });

    expect(result.ok).toBe('INVALID_STATE');
    if (result.ok === 'INVALID_STATE') {
      expect(result.current).toBe('ASSIGNED');
    }
  });
});

describe('treatment-workflow.service prescription', () => {
  it('rejects prescription when not diagnosed', async () => {
    findUnique.mockResolvedValue({
      id: 'wf1',
      serviceRequestId: 'case1',
      doctorId: 'doc1',
      status: 'CONSULTATION_STARTED',
      treatmentCaseId: null,
    });

    const service = new TreatmentWorkflowService();
    const result = await service.createPrescription('user1', 'case1', {
      items: [{ medicineName: 'Amoxicillin' }],
    });

    expect(result.ok).toBe('INVALID_STATE');
  });
});

describe('treatment-workflow.service followup', () => {
  it('rejects followup when not prescribed', async () => {
    findUnique.mockResolvedValue({
      id: 'wf1',
      serviceRequestId: 'case1',
      doctorId: 'doc1',
      status: 'DIAGNOSED',
      treatmentCaseId: 'tc1',
    });

    const service = new TreatmentWorkflowService();
    const result = await service.scheduleFollowup('user1', 'case1', {
      scheduledAt: '2026-06-01T10:00:00.000Z',
    });

    expect(result.ok).toBe('INVALID_STATE');
  });
});

describe('treatment-workflow.service notes', () => {
  it('rejects notes when workflow closed', async () => {
    findUnique.mockResolvedValue({
      id: 'wf1',
      serviceRequestId: 'case1',
      doctorId: 'doc1',
      status: 'CLOSED',
      treatmentCaseId: null,
    });

    const service = new TreatmentWorkflowService();
    const result = await service.createNote('user1', 'case1', {
      noteType: 'PRIVATE',
      content: 'Late note',
    });

    expect(result.ok).toBe('CLOSED');
  });
});
