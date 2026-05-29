import type { LivestockHealthRecord, LivestockVaccination } from '@/generated/prisma/client';

import type { HealthRecordDto, VaccinationDto } from './livestock-health.dto.js';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toHealthRecordDto(row: LivestockHealthRecord): HealthRecordDto {
  return {
    id: row.id,
    customerId: row.customerId,
    livestockId: row.livestockId,
    farmRef: row.farmRef,
    recordType: row.recordType,
    title: row.title,
    symptoms: row.symptoms,
    diagnosis: row.diagnosis,
    diseaseName: row.diseaseName,
    treatmentRef: row.treatmentRef,
    notes: row.notes,
    recordedDate: formatDate(row.recordedDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVaccinationDto(row: LivestockVaccination): VaccinationDto {
  return {
    id: row.id,
    customerId: row.customerId,
    livestockId: row.livestockId,
    farmRef: row.farmRef,
    vaccineName: row.vaccineName,
    vaccineType: row.vaccineType,
    scheduledDate: formatDate(row.scheduledDate),
    administeredDate: row.administeredDate ? formatDate(row.administeredDate) : null,
    nextDueDate: row.nextDueDate ? formatDate(row.nextDueDate) : null,
    status: row.status,
    batchNumber: row.batchNumber,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
