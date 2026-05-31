import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CompanyRegistryService,
  getCompanyRegistryService,
  resetCompanyRegistryServiceForTests,
} from '../knowledge/company-registry.service.js';

vi.mock('../../../../shared/database/prisma.js', () => {
  const mockPrisma = {
    vetCompany: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
  return { getPrisma: () => mockPrisma };
});

describe('CompanyRegistryService', () => {
  let service: CompanyRegistryService;

  beforeEach(() => {
    resetCompanyRegistryServiceForTests();
    service = getCompanyRegistryService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetCompanyRegistryServiceForTests();
  });

  describe('list', () => {
    it('returns paginated list of companies', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockCompanies = [
        {
          id: 'comp-1',
          companyCode: 'ACI-LTD',
          nameBn: 'এসিআই লিমিটেড',
          nameEn: 'ACI Limited',
          shortNameEn: 'ACI',
          status: 'ACTIVE',
          licenseNumber: 'LIC-001',
          address: 'Dhaka, Bangladesh',
          createdAt: new Date(),
          updatedAt: new Date(),
          verifiedAt: new Date(),
          verifiedByUserId: 'user-1',
        },
      ];

      vi.mocked(prisma.vetCompany.findMany).mockResolvedValue(mockCompanies);
      vi.mocked(prisma.vetCompany.count).mockResolvedValue(1);

      const result = await service.list({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].companyCode).toBe('ACI-LTD');
    });

    it('filters by status when provided', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.vetCompany.findMany).mockResolvedValue([]);
      vi.mocked(prisma.vetCompany.count).mockResolvedValue(0);

      await service.list({ status: 'ACTIVE', limit: 10, offset: 0 });

      expect(prisma.vetCompany.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns company when found', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockCompany = {
        id: 'comp-1',
        companyCode: 'ACI-LTD',
        nameBn: 'এসিআই লিমিটেড',
        nameEn: 'ACI Limited',
        shortNameEn: 'ACI',
        status: 'ACTIVE',
        licenseNumber: 'LIC-001',
        address: 'Dhaka, Bangladesh',
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedAt: new Date(),
        verifiedByUserId: 'user-1',
      };

      vi.mocked(prisma.vetCompany.findUnique).mockResolvedValue(mockCompany);

      const result = await service.getById('comp-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('comp-1');
    });

    it('returns null when not found', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.vetCompany.findUnique).mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a new company', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockCompany = {
        id: 'comp-new',
        companyCode: 'NEW-CO',
        nameBn: 'নতুন কোম্পানি',
        nameEn: 'New Company',
        shortNameEn: 'New',
        status: 'PENDING_VERIFICATION',
        licenseNumber: null,
        address: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedAt: null,
        verifiedByUserId: null,
      };

      vi.mocked(prisma.vetCompany.create).mockResolvedValue(mockCompany);

      const result = await service.create({
        companyCode: 'NEW-CO',
        nameBn: 'নতুন কোম্পানি',
        nameEn: 'New Company',
        shortNameEn: 'New',
      });

      expect(result.companyCode).toBe('NEW-CO');
      expect(result.status).toBe('PENDING_VERIFICATION');
    });
  });

  describe('verify', () => {
    it('verifies a company', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockCompany = {
        id: 'comp-1',
        companyCode: 'ACI-LTD',
        nameBn: 'এসিআই লিমিটেড',
        nameEn: 'ACI Limited',
        shortNameEn: 'ACI',
        status: 'ACTIVE',
        licenseNumber: 'LIC-001',
        address: 'Dhaka, Bangladesh',
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedAt: new Date(),
        verifiedByUserId: 'verifier-1',
      };

      vi.mocked(prisma.vetCompany.update).mockResolvedValue(mockCompany);

      const result = await service.verify('comp-1', 'verifier-1');

      expect(prisma.vetCompany.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comp-1' },
          data: expect.objectContaining({
            verifiedByUserId: 'verifier-1',
          }),
        }),
      );
      expect(result.verifiedByUserId).toBe('verifier-1');
    });
  });

  describe('getActiveCompanies', () => {
    it('returns only active companies', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.vetCompany.findMany).mockResolvedValue([]);

      await service.getActiveCompanies();

      expect(prisma.vetCompany.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        }),
      );
    });
  });

  describe('searchByName', () => {
    it('searches companies by name', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.vetCompany.findMany).mockResolvedValue([]);

      await service.searchByName('ACI');

      expect(prisma.vetCompany.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { nameEn: { contains: 'ACI', mode: 'insensitive' } },
              { nameBn: { contains: 'ACI' } },
              { shortNameEn: { contains: 'ACI', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });
});
