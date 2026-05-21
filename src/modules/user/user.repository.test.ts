import { describe, expect, it, vi, beforeEach } from 'vitest';

import { UserRole, UserStatus } from '../../generated/prisma/index.js';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  }),
}));

import { UserRepository } from './user.repository.js';

describe('UserRepository lifecycle', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  it('setCustomerStatus updates customer users', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    mockUpdate.mockResolvedValue({ id: 'u1', status: UserStatus.SUSPENDED });

    const repo = new UserRepository();
    const result = await repo.setCustomerStatus('u1', UserStatus.SUSPENDED);

    expect(result).toEqual({
      userId: 'u1',
      status: UserStatus.SUSPENDED,
      changed: true,
    });
  });

  it('setCustomerStatus returns null for non-customer', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u2',
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
    });

    const repo = new UserRepository();
    const result = await repo.setCustomerStatus('u2', UserStatus.SUSPENDED);
    expect(result).toBeNull();
  });
});
