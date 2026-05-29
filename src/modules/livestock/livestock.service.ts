import { LivestockAuditAction, Prisma } from '@/generated/prisma/client';

import { writeLivestockAudit } from '../phase4-shared/audit.js';
import { decimalToNumber, toDecimal } from '../phase4-shared/decimal.js';
import { OwnershipError, assertLivestockOwned } from '../phase4-shared/ownership.js';
import { parsePagination } from '../phase4-shared/query.js';
import { LIVESTOCK_ENTITY_TYPE, QR_PAYLOAD_PREFIX } from './constants.js';
import {
  toImageDto,
  toLivestockDto,
  type LivestockDto,
  type LivestockImageDto,
  type LivestockListResponseDto,
} from './livestock.dto.js';
import { getLivestockRepository } from './livestock.repository.js';
import type {
  CreateLivestockBody,
  CreateLivestockImageBody,
  ListLivestockQuery,
  UpdateLivestockBody,
} from './livestock.validator.js';

export class LivestockError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'DUPLICATE_EAR_TAG' | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'LivestockError';
  }
}

function buildQrPayload(id: string): string {
  return `${QR_PAYLOAD_PREFIX}${id}`;
}

function isDuplicateEarTagError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('earTagNumber')
  );
}

export class LivestockService {
  readonly name = 'LivestockService';

  constructor(private readonly repo = getLivestockRepository()) {}

  async create(
    customerId: string,
    body: CreateLivestockBody,
    actorUserId?: string,
  ): Promise<LivestockDto> {
    try {
      const created = await this.repo.create({
        customerId,
        farmRef: body.farmRef,
        deploymentBranch: body.deploymentBranch ?? null,
        name: body.name,
        species: body.species,
        customSpeciesLabel: body.customSpeciesLabel ?? null,
        breedId: body.breedId ?? null,
        breedName: body.breedName ?? null,
        gender: body.gender,
        ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
        ...(body.healthStatus !== undefined ? { healthStatus: body.healthStatus } : {}),
        dateOfBirth: body.dateOfBirth ?? null,
        weightKg: toDecimal(body.weightKg),
        ...(body.weightKg != null ? { lastWeightAt: new Date() } : {}),
        earTagNumber: body.earTagNumber?.trim() || null,
        pregnancyStatus: body.pregnancyStatus ?? null,
        lactationNumber: body.lactationNumber ?? null,
        lastCalvingDate: body.lastCalvingDate ?? null,
        photoUrl: body.photoUrl ?? null,
        purchaseDate: body.purchaseDate ?? null,
        purchasePriceBdt: toDecimal(body.purchasePriceBdt),
        notes: body.notes ?? null,
      });

      const qrCodePayload = buildQrPayload(created.id);
      const withQr = await this.repo.update(created.id, { qrCodePayload });

      await writeLivestockAudit(
        customerId,
        LivestockAuditAction.LIVESTOCK_CREATED,
        LIVESTOCK_ENTITY_TYPE,
        withQr.id,
        actorUserId,
        {
          farmRef: withQr.farmRef,
          species: withQr.species,
          name: withQr.name,
        },
      );

      return toLivestockDto(withQr, { includeImages: true });
    } catch (error) {
      if (isDuplicateEarTagError(error)) {
        throw new LivestockError('DUPLICATE_EAR_TAG', 'Ear tag number already in use');
      }
      throw error;
    }
  }

  async getById(customerId: string, id: string): Promise<LivestockDto> {
    const row = await this.repo.findById(customerId, id);
    if (!row) {
      throw new OwnershipError('NOT_FOUND', 'Livestock not found');
    }
    return toLivestockDto(row, { includeImages: true });
  }

  async list(customerId: string, query: ListLivestockQuery): Promise<LivestockListResponseDto> {
    const { page, limit, skip } = parsePagination(query);
    const { rows, total } = await this.repo.list({
      customerId,
      ...(query.farmRef ? { farmRef: query.farmRef } : {}),
      ...(query.species ? { species: query.species } : {}),
      ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.search ? { search: query.search } : {}),
      includeInactive: query.includeInactive ?? false,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
    });

    return {
      items: rows.map((row) => toLivestockDto(row, { includeImages: true })),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async update(
    customerId: string,
    id: string,
    body: UpdateLivestockBody,
    actorUserId?: string,
  ): Promise<LivestockDto> {
    await assertLivestockOwned(customerId, id);

    if (
      body.species === 'CUSTOM' &&
      body.customSpeciesLabel !== undefined &&
      !body.customSpeciesLabel?.trim()
    ) {
      throw new LivestockError(
        'VALIDATION_ERROR',
        'customSpeciesLabel is required when species is CUSTOM',
      );
    }

    try {
      const updated = await this.repo.update(id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.species !== undefined ? { species: body.species } : {}),
        ...(body.customSpeciesLabel !== undefined
          ? { customSpeciesLabel: body.customSpeciesLabel }
          : {}),
        ...(body.breedId !== undefined ? { breedId: body.breedId } : {}),
        ...(body.breedName !== undefined ? { breedName: body.breedName } : {}),
        ...(body.gender !== undefined ? { gender: body.gender } : {}),
        ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
        ...(body.lifecycleStatus !== undefined
          ? { lifecycleStatus: body.lifecycleStatus }
          : {}),
        ...(body.healthStatus !== undefined ? { healthStatus: body.healthStatus } : {}),
        ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth } : {}),
        ...(body.weightKg !== undefined
          ? {
              weightKg: toDecimal(body.weightKg),
              ...(body.weightKg != null
                ? { lastWeightAt: new Date() }
                : { lastWeightAt: null }),
            }
          : {}),
        ...(body.earTagNumber !== undefined
          ? { earTagNumber: body.earTagNumber?.trim() || null }
          : {}),
        ...(body.pregnancyStatus !== undefined
          ? { pregnancyStatus: body.pregnancyStatus }
          : {}),
        ...(body.lactationNumber !== undefined
          ? { lactationNumber: body.lactationNumber }
          : {}),
        ...(body.lastCalvingDate !== undefined
          ? { lastCalvingDate: body.lastCalvingDate }
          : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
        ...(body.purchaseDate !== undefined ? { purchaseDate: body.purchaseDate } : {}),
        ...(body.purchasePriceBdt !== undefined
          ? { purchasePriceBdt: toDecimal(body.purchasePriceBdt) }
          : {}),
        ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
        ...(body.salePriceBdt !== undefined
          ? { salePriceBdt: toDecimal(body.salePriceBdt) }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });

      await writeLivestockAudit(
        customerId,
        LivestockAuditAction.LIVESTOCK_UPDATED,
        LIVESTOCK_ENTITY_TYPE,
        updated.id,
        actorUserId,
        {
          changes: Object.keys(body),
          weightKg: decimalToNumber(updated.weightKg),
        },
      );

      return toLivestockDto(updated, { includeImages: true });
    } catch (error) {
      if (isDuplicateEarTagError(error)) {
        throw new LivestockError('DUPLICATE_EAR_TAG', 'Ear tag number already in use');
      }
      throw error;
    }
  }

  async softDelete(
    customerId: string,
    id: string,
    actorUserId?: string,
  ): Promise<LivestockDto> {
    await assertLivestockOwned(customerId, id);
    const deleted = await this.repo.softDelete(id);

    await writeLivestockAudit(
      customerId,
      LivestockAuditAction.LIVESTOCK_DELETED,
      LIVESTOCK_ENTITY_TYPE,
      deleted.id,
      actorUserId,
      { farmRef: deleted.farmRef, name: deleted.name },
    );

    return toLivestockDto(deleted, { includeImages: true });
  }

  async addImage(
    customerId: string,
    livestockId: string,
    body: CreateLivestockImageBody,
  ): Promise<LivestockImageDto> {
    await assertLivestockOwned(customerId, livestockId);

    const sortOrder =
      body.sortOrder ?? (await this.repo.nextImageSortOrder(livestockId));

    const image = await this.repo.addImage({
      livestockId,
      url: body.url,
      uploadedFileId: body.uploadedFileId ?? null,
      caption: body.caption ?? null,
      sortOrder,
    });

    if (!body.caption) {
      const livestock = await this.repo.findById(customerId, livestockId);
      if (livestock && !livestock.photoUrl) {
        await this.repo.update(livestockId, { photoUrl: body.url });
      }
    }

    return toImageDto(image);
  }

  async listImages(customerId: string, livestockId: string): Promise<LivestockImageDto[]> {
    await assertLivestockOwned(customerId, livestockId);
    const images = await this.repo.listImages(customerId, livestockId);
    return images.map(toImageDto);
  }

  async deleteImage(
    customerId: string,
    livestockId: string,
    imageId: string,
  ): Promise<void> {
    await assertLivestockOwned(customerId, livestockId);
    const image = await this.repo.findImage(customerId, livestockId, imageId);
    if (!image) {
      throw new OwnershipError('NOT_FOUND', 'Livestock image not found');
    }
    await this.repo.deleteImage(imageId);
  }
}

let serviceSingleton: LivestockService | undefined;

export function getLivestockService(): LivestockService {
  if (!serviceSingleton) {
    serviceSingleton = new LivestockService();
  }
  return serviceSingleton;
}
