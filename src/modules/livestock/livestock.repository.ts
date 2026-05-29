import { LivestockLifecycleStatus, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

import type {
  LivestockCreateData,
  LivestockImageCreateData,
  LivestockImageRow,
  LivestockListParams,
  LivestockListResult,
  LivestockRow,
  LivestockUpdateData,
} from './types.js';

const livestockInclude = {
  images: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.LivestockInclude;

export class LivestockRepository {
  readonly name = 'LivestockRepository';

  async create(data: LivestockCreateData): Promise<LivestockRow> {
    return prisma.livestock.create({
      data: {
        customerId: data.customerId,
        farmRef: data.farmRef,
        deploymentBranch: data.deploymentBranch ?? null,
        name: data.name,
        species: data.species,
        customSpeciesLabel: data.customSpeciesLabel ?? null,
        breedId: data.breedId ?? null,
        breedName: data.breedName ?? null,
        gender: data.gender,
        ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
        ...(data.lifecycleStatus !== undefined ? { lifecycleStatus: data.lifecycleStatus } : {}),
        ...(data.healthStatus !== undefined ? { healthStatus: data.healthStatus } : {}),
        dateOfBirth: data.dateOfBirth ?? null,
        weightKg: data.weightKg ?? null,
        lastWeightAt: data.lastWeightAt ?? null,
        earTagNumber: data.earTagNumber ?? null,
        qrCodePayload: data.qrCodePayload ?? null,
        pregnancyStatus: data.pregnancyStatus ?? null,
        lactationNumber: data.lactationNumber ?? null,
        lastCalvingDate: data.lastCalvingDate ?? null,
        photoUrl: data.photoUrl ?? null,
        purchaseDate: data.purchaseDate ?? null,
        purchasePriceBdt: data.purchasePriceBdt ?? null,
        notes: data.notes ?? null,
      },
      include: livestockInclude,
    });
  }

  async findById(customerId: string, id: string): Promise<LivestockRow | null> {
    return prisma.livestock.findFirst({
      where: { id, customerId, deletedAt: null },
      include: livestockInclude,
    });
  }

  async findByIdIncludingDeleted(
    customerId: string,
    id: string,
  ): Promise<LivestockRow | null> {
    return prisma.livestock.findFirst({
      where: { id, customerId },
      include: livestockInclude,
    });
  }

  async list(params: LivestockListParams): Promise<LivestockListResult> {
    const search = params.search?.trim();

    const where: Prisma.LivestockWhereInput = {
      customerId: params.customerId,
      deletedAt: null,
      ...(params.farmRef ? { farmRef: params.farmRef } : {}),
      ...(params.species ? { species: params.species } : {}),
      ...(params.gender ? { gender: params.gender } : {}),
      ...(params.lifecycleStatus
        ? { lifecycleStatus: params.lifecycleStatus }
        : !params.includeInactive
          ? { lifecycleStatus: { not: LivestockLifecycleStatus.INACTIVE } }
          : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { earTagNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.livestock.count({ where }),
      prisma.livestock.findMany({
        where,
        include: livestockInclude,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }

  async update(id: string, data: LivestockUpdateData): Promise<LivestockRow> {
    return prisma.livestock.update({
      where: { id },
      data: {
        ...(data.deploymentBranch !== undefined
          ? { deploymentBranch: data.deploymentBranch }
          : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.species !== undefined ? { species: data.species } : {}),
        ...(data.customSpeciesLabel !== undefined
          ? { customSpeciesLabel: data.customSpeciesLabel }
          : {}),
        ...(data.breedId !== undefined ? { breedId: data.breedId } : {}),
        ...(data.breedName !== undefined ? { breedName: data.breedName } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
        ...(data.lifecycleStatus !== undefined
          ? { lifecycleStatus: data.lifecycleStatus }
          : {}),
        ...(data.healthStatus !== undefined ? { healthStatus: data.healthStatus } : {}),
        ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth } : {}),
        ...(data.weightKg !== undefined ? { weightKg: data.weightKg } : {}),
        ...(data.lastWeightAt !== undefined ? { lastWeightAt: data.lastWeightAt } : {}),
        ...(data.earTagNumber !== undefined ? { earTagNumber: data.earTagNumber } : {}),
        ...(data.qrCodePayload !== undefined ? { qrCodePayload: data.qrCodePayload } : {}),
        ...(data.pregnancyStatus !== undefined
          ? { pregnancyStatus: data.pregnancyStatus }
          : {}),
        ...(data.lactationNumber !== undefined
          ? { lactationNumber: data.lactationNumber }
          : {}),
        ...(data.lastCalvingDate !== undefined
          ? { lastCalvingDate: data.lastCalvingDate }
          : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate } : {}),
        ...(data.purchasePriceBdt !== undefined
          ? { purchasePriceBdt: data.purchasePriceBdt }
          : {}),
        ...(data.saleDate !== undefined ? { saleDate: data.saleDate } : {}),
        ...(data.salePriceBdt !== undefined ? { salePriceBdt: data.salePriceBdt } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: livestockInclude,
    });
  }

  async softDelete(id: string): Promise<LivestockRow> {
    return prisma.livestock.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        lifecycleStatus: LivestockLifecycleStatus.INACTIVE,
      },
      include: livestockInclude,
    });
  }

  async listImages(customerId: string, livestockId: string): Promise<LivestockImageRow[]> {
    return prisma.livestockImage.findMany({
      where: {
        livestockId,
        livestock: { customerId, deletedAt: null },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addImage(data: LivestockImageCreateData): Promise<LivestockImageRow> {
    return prisma.livestockImage.create({
      data: {
        livestockId: data.livestockId,
        url: data.url,
        uploadedFileId: data.uploadedFileId ?? null,
        caption: data.caption ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async findImage(
    customerId: string,
    livestockId: string,
    imageId: string,
  ): Promise<LivestockImageRow | null> {
    return prisma.livestockImage.findFirst({
      where: {
        id: imageId,
        livestockId,
        livestock: { customerId, deletedAt: null },
      },
    });
  }

  async deleteImage(imageId: string): Promise<void> {
    await prisma.livestockImage.delete({ where: { id: imageId } });
  }

  async nextImageSortOrder(livestockId: string): Promise<number> {
    const latest = await prisma.livestockImage.findFirst({
      where: { livestockId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (latest?.sortOrder ?? -1) + 1;
  }
}

let repositorySingleton: LivestockRepository | undefined;

export function getLivestockRepository(): LivestockRepository {
  if (!repositorySingleton) {
    repositorySingleton = new LivestockRepository();
  }
  return repositorySingleton;
}
