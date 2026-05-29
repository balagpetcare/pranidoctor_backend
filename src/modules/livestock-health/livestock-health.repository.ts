import type {
  LivestockHealthRecordType,
  LivestockVaccinationStatus,
  Prisma,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

export class LivestockHealthRepository {
  async listHealthRecords(params: {
    customerId: string;
    livestockId: string;
    skip: number;
    take: number;
    recordType?: LivestockHealthRecordType;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.LivestockHealthRecordWhereInput = {
      customerId: params.customerId,
      livestockId: params.livestockId,
      ...(params.recordType ? { recordType: params.recordType } : {}),
      ...(params.from || params.to
        ? {
            recordedDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.livestockHealthRecord.count({ where }),
      prisma.livestockHealthRecord.findMany({
        where,
        orderBy: [{ recordedDate: 'desc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }

  async findHealthRecordById(customerId: string, livestockId: string, id: string) {
    return prisma.livestockHealthRecord.findFirst({
      where: { id, customerId, livestockId },
    });
  }

  async createHealthRecord(data: Prisma.LivestockHealthRecordCreateInput) {
    return prisma.livestockHealthRecord.create({ data });
  }

  async updateHealthRecord(id: string, data: Prisma.LivestockHealthRecordUpdateInput) {
    return prisma.livestockHealthRecord.update({ where: { id }, data });
  }

  async deleteHealthRecord(id: string) {
    return prisma.livestockHealthRecord.delete({ where: { id } });
  }

  async listVaccinations(params: {
    customerId: string;
    livestockId: string;
    skip: number;
    take: number;
    status?: LivestockVaccinationStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.LivestockVaccinationWhereInput = {
      customerId: params.customerId,
      livestockId: params.livestockId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.from || params.to
        ? {
            scheduledDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.livestockVaccination.count({ where }),
      prisma.livestockVaccination.findMany({
        where,
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }

  async findVaccinationById(customerId: string, livestockId: string, id: string) {
    return prisma.livestockVaccination.findFirst({
      where: { id, customerId, livestockId },
    });
  }

  async createVaccination(data: Prisma.LivestockVaccinationCreateInput) {
    return prisma.livestockVaccination.create({ data });
  }

  async updateVaccination(id: string, data: Prisma.LivestockVaccinationUpdateInput) {
    return prisma.livestockVaccination.update({ where: { id }, data });
  }
}

let repositorySingleton: LivestockHealthRepository | undefined;

export function getLivestockHealthRepository(): LivestockHealthRepository {
  if (!repositorySingleton) {
    repositorySingleton = new LivestockHealthRepository();
  }
  return repositorySingleton;
}
