import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  userDevice: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  userSession: {
    updateMany: vi.fn(),
  },
};

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => mockPrisma,
}));

describe('DeviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts device by userId and deviceKey', async () => {
    const { DeviceService } = await import('./device.service.js');
    const svc = new DeviceService();

    mockPrisma.userDevice.findUnique.mockResolvedValue(null);
    mockPrisma.userDevice.upsert.mockResolvedValue({ id: 'dev-1' });

    const result = await svc.registerOrUpdate({
      userId: 'user-1',
      deviceKey: 'device-abc',
      platform: 'android',
    });

    expect(result.id).toBe('dev-1');
    expect(result.replaced).toBe(false);
    expect(mockPrisma.userDevice.upsert).toHaveBeenCalled();
  });

  it('marks replaced when deviceKey already exists', async () => {
    const { DeviceService } = await import('./device.service.js');
    const svc = new DeviceService();

    mockPrisma.userDevice.findUnique.mockResolvedValue({ id: 'dev-old' });
    mockPrisma.userDevice.upsert.mockResolvedValue({ id: 'dev-old' });

    const result = await svc.registerOrUpdate({
      userId: 'user-1',
      deviceKey: 'device-abc',
    });

    expect(result.replaced).toBe(true);
  });
});
