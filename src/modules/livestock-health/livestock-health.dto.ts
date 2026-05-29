import type {
  LivestockHealthRecordType,
  LivestockVaccinationStatus,
} from '@/generated/prisma/client';

export type HealthRecordDto = {
  id: string;
  customerId: string;
  livestockId: string;
  farmRef: string | null;
  recordType: LivestockHealthRecordType;
  title: string;
  symptoms: string | null;
  diagnosis: string | null;
  diseaseName: string | null;
  treatmentRef: string | null;
  notes: string | null;
  recordedDate: string;
  createdAt: string;
  updatedAt: string;
};

export type VaccinationDto = {
  id: string;
  customerId: string;
  livestockId: string;
  farmRef: string | null;
  vaccineName: string;
  vaccineType: string | null;
  scheduledDate: string;
  administeredDate: string | null;
  nextDueDate: string | null;
  status: LivestockVaccinationStatus;
  batchNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedHealthRecordsDto = {
  items: HealthRecordDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type PaginatedVaccinationsDto = {
  items: VaccinationDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};
