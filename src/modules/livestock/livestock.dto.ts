import type {
  LivestockGender,
  LivestockHealthStatus,
  LivestockLifecycleStatus,
  LivestockPurpose,
  LivestockSpecies,
  PregnancyStatus,
} from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';
import { SPECIES_LABELS } from './constants.js';
import type { LivestockImageRow, LivestockRow } from './types.js';

export type LivestockDto = {
  id: string;
  customerId: string;
  farmRef: string;
  deploymentBranch: string | null;
  name: string;
  species: LivestockSpecies;
  speciesLabelEn: string;
  speciesLabelBn: string;
  customSpeciesLabel: string | null;
  breedId: string | null;
  breedName: string | null;
  gender: LivestockGender;
  purpose: LivestockPurpose;
  lifecycleStatus: LivestockLifecycleStatus;
  healthStatus: LivestockHealthStatus;
  dateOfBirth: string | null;
  weightKg: number | null;
  lastWeightAt: string | null;
  earTagNumber: string | null;
  qrCodePayload: string | null;
  pregnancyStatus: PregnancyStatus | null;
  lactationNumber: number | null;
  lastCalvingDate: string | null;
  photoUrl: string | null;
  purchaseDate: string | null;
  purchasePriceBdt: number | null;
  saleDate: string | null;
  salePriceBdt: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  images?: LivestockImageDto[];
};

export type LivestockImageDto = {
  id: string;
  livestockId: string;
  url: string;
  uploadedFileId: string | null;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
};

export type LivestockListResponseDto = {
  items: LivestockDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function toImageDto(image: LivestockImageRow): LivestockImageDto {
  return {
    id: image.id,
    livestockId: image.livestockId,
    url: image.url,
    uploadedFileId: image.uploadedFileId,
    caption: image.caption,
    sortOrder: image.sortOrder,
    createdAt: image.createdAt.toISOString(),
  };
}

export function toLivestockDto(
  row: LivestockRow,
  options?: { includeImages?: boolean },
): LivestockDto {
  const labels = SPECIES_LABELS[row.species] ?? SPECIES_LABELS.OTHER;

  const dto: LivestockDto = {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    deploymentBranch: row.deploymentBranch,
    name: row.name,
    species: row.species,
    speciesLabelEn: labels.en,
    speciesLabelBn: labels.bn,
    customSpeciesLabel: row.customSpeciesLabel,
    breedId: row.breedId,
    breedName: row.breedName,
    gender: row.gender,
    purpose: row.purpose ?? 'MIXED',
    lifecycleStatus: row.lifecycleStatus,
    healthStatus: row.healthStatus,
    dateOfBirth: formatDate(row.dateOfBirth),
    weightKg: decimalToNumber(row.weightKg),
    lastWeightAt: formatDateTime(row.lastWeightAt),
    earTagNumber: row.earTagNumber,
    qrCodePayload: row.qrCodePayload,
    pregnancyStatus: row.pregnancyStatus,
    lactationNumber: row.lactationNumber,
    lastCalvingDate: formatDate(row.lastCalvingDate),
    photoUrl: row.photoUrl,
    purchaseDate: formatDate(row.purchaseDate),
    purchasePriceBdt: decimalToNumber(row.purchasePriceBdt),
    saleDate: formatDate(row.saleDate),
    salePriceBdt: decimalToNumber(row.salePriceBdt),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: formatDateTime(row.deletedAt),
  };

  if (options?.includeImages && row.images) {
    dto.images = row.images.map(toImageDto);
  }

  return dto;
}
