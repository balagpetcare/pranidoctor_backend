import type {
  Livestock,
  LivestockGender,
  LivestockHealthStatus,
  LivestockImage,
  LivestockLifecycleStatus,
  LivestockPurpose,
  LivestockSpecies,
  PregnancyStatus,
  Prisma,
} from '@/generated/prisma/client';

export type LivestockRow = Livestock & {
  images?: LivestockImage[];
};

export type LivestockImageRow = LivestockImage;

export type LivestockListParams = {
  customerId: string;
  farmRef?: string;
  species?: LivestockSpecies;
  lifecycleStatus?: LivestockLifecycleStatus;
  gender?: LivestockGender;
  search?: string;
  includeInactive?: boolean;
  skip: number;
  take: number;
  orderBy?: Prisma.LivestockOrderByWithRelationInput;
};

export type LivestockListResult = {
  rows: LivestockRow[];
  total: number;
};

export type LivestockCreateData = {
  customerId: string;
  farmRef: string;
  deploymentBranch?: string | null;
  name: string;
  species: LivestockSpecies;
  customSpeciesLabel?: string | null;
  breedId?: string | null;
  breedName?: string | null;
  gender: LivestockGender;
  purpose?: LivestockPurpose;
  lifecycleStatus?: LivestockLifecycleStatus;
  healthStatus?: LivestockHealthStatus;
  dateOfBirth?: Date | null;
  weightKg?: Prisma.Decimal | null;
  lastWeightAt?: Date | null;
  earTagNumber?: string | null;
  qrCodePayload?: string | null;
  pregnancyStatus?: PregnancyStatus | null;
  lactationNumber?: number | null;
  lastCalvingDate?: Date | null;
  photoUrl?: string | null;
  purchaseDate?: Date | null;
  purchasePriceBdt?: Prisma.Decimal | null;
  notes?: string | null;
};

export type LivestockUpdateData = Partial<
  Omit<LivestockCreateData, 'customerId' | 'farmRef'>
> & {
  saleDate?: Date | null;
  salePriceBdt?: Prisma.Decimal | null;
};

export type LivestockImageCreateData = {
  livestockId: string;
  url: string;
  uploadedFileId?: string | null;
  caption?: string | null;
  sortOrder?: number;
};
