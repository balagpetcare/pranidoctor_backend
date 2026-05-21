import { describe, expect, it, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const doctorFindUnique = vi.fn();

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    serviceRequest: { findFirst },
    doctorProfile: { findUnique: doctorFindUnique },
  }),
}));

import {
  assertAssignedDoctorAccess,
  resolveDoctorProfileId,
} from '../guards/treatment-access.guard.js';

describe('treatment-access.guard', () => {
  beforeEach(() => {
    findFirst.mockReset();
    doctorFindUnique.mockReset();
  });

  it('resolves doctor profile by user id', async () => {
    doctorFindUnique.mockResolvedValue({ id: 'doc1' });
    await expect(resolveDoctorProfileId('user1')).resolves.toBe('doc1');
  });

  it('returns NOT_FOUND when case is not assigned', async () => {
    doctorFindUnique.mockResolvedValue({ id: 'doc1' });
    findFirst.mockResolvedValue(null);

    const result = await assertAssignedDoctorAccess('user1', 'case1');
    expect(result.ok).toBe('NOT_FOUND');
  });

  it('returns ALLOWED for assigned active case', async () => {
    doctorFindUnique.mockResolvedValue({ id: 'doc1' });
    findFirst.mockResolvedValue({ animalId: 'animal1', status: 'ACCEPTED' });

    const result = await assertAssignedDoctorAccess('user1', 'case1');
    expect(result).toEqual({ ok: 'ALLOWED', doctorProfileId: 'doc1', animalId: 'animal1' });
  });

  it('returns FORBIDDEN when doctor profile missing', async () => {
    doctorFindUnique.mockResolvedValue(null);
    const result = await assertAssignedDoctorAccess('user1', 'case1');
    expect(result.ok).toBe('FORBIDDEN');
  });
});
