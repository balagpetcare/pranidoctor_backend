import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ContractService,
  getContractService,
  resetContractServiceForTests,
} from '../contracts/contract.service.js';

vi.mock('../../../../shared/database/prisma.js', () => {
  const mockPrisma = {
    medicineContract: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    medicineContractBrand: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    medicineContractAudit: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        medicineContract: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        medicineContractBrand: {
          findMany: vi.fn(),
          create: vi.fn(),
          delete: vi.fn(),
        },
        medicineContractAudit: {
          create: vi.fn(),
        },
      }),
    ),
  };
  return { getPrisma: () => mockPrisma };
});

describe('ContractService', () => {
  let service: ContractService;

  beforeEach(() => {
    resetContractServiceForTests();
    service = getContractService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetContractServiceForTests();
  });

  describe('list', () => {
    it('returns paginated list of contracts', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockContracts = [
        {
          id: 'contract-1',
          contractCode: 'CAMP-2024-Q1',
          titleBn: 'ক্যাম্পেইন ২০২৪',
          titleEn: 'Campaign 2024 Q1',
          contractType: 'CAMPAIGN',
          status: 'ACTIVE',
          priorityScore: 100,
          effectiveDate: new Date(),
          expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          budgetBdt: 100000,
          spentBdt: 0,
          targetRegions: ['dhaka'],
          targetOrganizationIds: [],
          targetSpecies: ['CATTLE'],
          sponsorCompanyId: null,
          ruleJson: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          sponsorCompany: null,
        },
      ];

      vi.mocked(prisma.medicineContract.findMany).mockResolvedValue(mockContracts);
      vi.mocked(prisma.medicineContract.count).mockResolvedValue(1);

      const result = await service.list({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].contractCode).toBe('CAMP-2024-Q1');
    });

    it('filters by status', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.medicineContract.findMany).mockResolvedValue([]);
      vi.mocked(prisma.medicineContract.count).mockResolvedValue(0);

      await service.list({ status: 'ACTIVE', limit: 10, offset: 0 });

      expect(prisma.medicineContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('filters by contract type', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.medicineContract.findMany).mockResolvedValue([]);
      vi.mocked(prisma.medicineContract.count).mockResolvedValue(0);

      await service.list({ contractType: 'SPONSOR', limit: 10, offset: 0 });

      expect(prisma.medicineContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contractType: 'SPONSOR' }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns contract when found', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockContract = {
        id: 'contract-1',
        contractCode: 'CAMP-2024-Q1',
        titleBn: 'ক্যাম্পেইন ২০২৪',
        titleEn: 'Campaign 2024 Q1',
        contractType: 'CAMPAIGN',
        status: 'ACTIVE',
        priorityScore: 100,
        effectiveDate: new Date(),
        expiryDate: new Date(),
        budgetBdt: 100000,
        spentBdt: 0,
        targetRegions: ['dhaka'],
        targetOrganizationIds: [],
        targetSpecies: ['CATTLE'],
        sponsorCompanyId: null,
        ruleJson: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        sponsorCompany: null,
      };

      vi.mocked(prisma.medicineContract.findUnique).mockResolvedValue(mockContract);

      const result = await service.getById('contract-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('contract-1');
    });

    it('returns null when not found', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.medicineContract.findUnique).mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a new contract', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockContract = {
        id: 'contract-new',
        contractCode: 'NEW-CAMP',
        titleBn: 'নতুন ক্যাম্পেইন',
        titleEn: 'New Campaign',
        contractType: 'CAMPAIGN',
        status: 'DRAFT',
        priorityScore: 100,
        effectiveDate: new Date(),
        expiryDate: null,
        budgetBdt: 50000,
        spentBdt: 0,
        targetRegions: [],
        targetOrganizationIds: [],
        targetSpecies: [],
        sponsorCompanyId: null,
        ruleJson: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        sponsorCompany: null,
      };

      vi.mocked(prisma.medicineContract.create).mockResolvedValue(mockContract);

      const result = await service.create(
        {
          contractCode: 'NEW-CAMP',
          titleBn: 'নতুন ক্যাম্পেইন',
          titleEn: 'New Campaign',
          contractType: 'CAMPAIGN',
          effectiveDate: new Date(),
          budgetBdt: 50000,
        },
        'user-1',
      );

      expect(result.contractCode).toBe('NEW-CAMP');
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('activate', () => {
    it('activates a draft contract', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockContract = {
        id: 'contract-1',
        contractCode: 'CAMP-2024',
        titleBn: 'ক্যাম্পেইন',
        titleEn: 'Campaign',
        contractType: 'CAMPAIGN',
        status: 'ACTIVE',
        priorityScore: 100,
        effectiveDate: new Date(),
        expiryDate: null,
        budgetBdt: 50000,
        spentBdt: 0,
        targetRegions: [],
        targetOrganizationIds: [],
        targetSpecies: [],
        sponsorCompanyId: null,
        ruleJson: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        sponsorCompany: null,
      };

      vi.mocked(prisma.medicineContract.update).mockResolvedValue(mockContract);

      const result = await service.activate('contract-1', 'user-1');

      expect(prisma.medicineContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-1' },
          data: { status: 'ACTIVE' },
        }),
      );
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('pause', () => {
    it('pauses an active contract', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockContract = {
        id: 'contract-1',
        contractCode: 'CAMP-2024',
        titleBn: 'ক্যাম্পেইন',
        titleEn: 'Campaign',
        contractType: 'CAMPAIGN',
        status: 'PAUSED',
        priorityScore: 100,
        effectiveDate: new Date(),
        expiryDate: null,
        budgetBdt: 50000,
        spentBdt: 0,
        targetRegions: [],
        targetOrganizationIds: [],
        targetSpecies: [],
        sponsorCompanyId: null,
        ruleJson: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        sponsorCompany: null,
      };

      vi.mocked(prisma.medicineContract.update).mockResolvedValue(mockContract);

      const result = await service.pause('contract-1', 'user-1');

      expect(result.status).toBe('PAUSED');
    });
  });

  describe('addBrand', () => {
    it('adds a brand to contract', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      vi.mocked(prisma.medicineContractBrand.create).mockResolvedValue({
        id: 'cb-1',
        contractId: 'contract-1',
        brandId: 'brand-1',
        boostScore: 10,
        createdAt: new Date(),
      });

      await service.addBrand('contract-1', 'brand-1', 10, 'user-1');

      expect(prisma.medicineContractBrand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: 'contract-1',
            brandId: 'brand-1',
            boostScore: 10,
          }),
        }),
      );
    });
  });

  describe('getContractBrands', () => {
    it('returns brands for a contract', async () => {
      const { getPrisma } = await import('../../../../shared/database/prisma.js');
      const prisma = getPrisma();

      const mockBrands = [
        {
          id: 'cb-1',
          contractId: 'contract-1',
          brandId: 'brand-1',
          boostScore: 10,
          createdAt: new Date(),
          brand: {
            id: 'brand-1',
            brandCode: 'BRAND1',
            nameBn: 'ব্র্যান্ড ১',
            nameEn: 'Brand 1',
            company: {
              id: 'comp-1',
              companyCode: 'COMP1',
              nameEn: 'Company 1',
            },
          },
        },
      ];

      vi.mocked(prisma.medicineContractBrand.findMany).mockResolvedValue(mockBrands);

      const result = await service.getContractBrands('contract-1');

      expect(result).toHaveLength(1);
      expect(result[0].brandCode).toBe('BRAND1');
    });
  });
});
