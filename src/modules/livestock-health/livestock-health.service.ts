import { LivestockVaccinationStatus } from '@/generated/prisma/client';

import { writeLivestockAudit } from '../phase4-shared/audit.js';
import { OwnershipError, assertLivestockOwned } from '../phase4-shared/ownership.js';
import { parseDateParam } from '../phase4-shared/query.js';
import type {
  HealthRecordDto,
  PaginatedHealthRecordsDto,
  PaginatedVaccinationsDto,
  VaccinationDto,
} from './livestock-health.dto.js';
import { toHealthRecordDto, toVaccinationDto } from './livestock-health.mapper.js';
import { getLivestockHealthRepository } from './livestock-health.repository.js';
import type {
  CreateHealthRecordBody,
  CreateVaccinationBody,
  HealthRecordListQuery,
  MarkVaccinationCompletedBody,
  UpdateHealthRecordBody,
  UpdateVaccinationBody,
  VaccinationListQuery,
} from './livestock-health.schemas.js';

export class LivestockHealthNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LivestockHealthNotFoundError';
  }
}

function parseBusinessDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export class LivestockHealthService {
  constructor(private readonly repo = getLivestockHealthRepository()) {}

  async listHealthRecords(
    customerId: string,
    livestockId: string,
    query: HealthRecordListQuery,
  ): Promise<PaginatedHealthRecordsDto> {
    await assertLivestockOwned(customerId, livestockId);

    const skip = (query.page - 1) * query.limit;
    const listParams = {
      customerId,
      livestockId,
      skip,
      take: query.limit,
      ...(query.recordType ? { recordType: query.recordType } : {}),
    };
    const from = parseDateParam(query.from);
    const to = parseDateParam(query.to);
    if (from) Object.assign(listParams, { from });
    if (to) Object.assign(listParams, { to });

    const { rows, total } = await this.repo.listHealthRecords(listParams);

    return {
      items: rows.map(toHealthRecordDto),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async createHealthRecord(
    customerId: string,
    livestockId: string,
    body: CreateHealthRecordBody,
    actorUserId?: string,
  ): Promise<HealthRecordDto> {
    const livestock = await assertLivestockOwned(customerId, livestockId);

    const row = await this.repo.createHealthRecord({
      customerId,
      livestock: { connect: { id: livestockId } },
      farmRef: body.farmRef ?? livestock.farmRef,
      recordType: body.recordType,
      title: body.title,
      symptoms: body.symptoms ?? null,
      diagnosis: body.diagnosis ?? null,
      diseaseName: body.diseaseName ?? null,
      treatmentRef: body.treatmentRef ?? null,
      notes: body.notes ?? null,
      recordedDate: parseBusinessDate(body.recordedDate),
    });

    await writeLivestockAudit(
      customerId,
      'HEALTH_RECORD_CREATED',
      'LivestockHealthRecord',
      row.id,
      actorUserId,
      { livestockId, recordType: row.recordType },
    );

    return toHealthRecordDto(row);
  }

  async getHealthRecordById(
    customerId: string,
    livestockId: string,
    id: string,
  ): Promise<HealthRecordDto> {
    await assertLivestockOwned(customerId, livestockId);

    const row = await this.repo.findHealthRecordById(customerId, livestockId, id);
    if (!row) throw new LivestockHealthNotFoundError('Health record not found');
    return toHealthRecordDto(row);
  }

  async updateHealthRecord(
    customerId: string,
    livestockId: string,
    id: string,
    body: UpdateHealthRecordBody,
  ): Promise<HealthRecordDto> {
    await assertLivestockOwned(customerId, livestockId);

    const existing = await this.repo.findHealthRecordById(customerId, livestockId, id);
    if (!existing) throw new LivestockHealthNotFoundError('Health record not found');

    const row = await this.repo.updateHealthRecord(id, {
      ...(body.recordType !== undefined ? { recordType: body.recordType } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.symptoms !== undefined ? { symptoms: body.symptoms } : {}),
      ...(body.diagnosis !== undefined ? { diagnosis: body.diagnosis } : {}),
      ...(body.diseaseName !== undefined ? { diseaseName: body.diseaseName } : {}),
      ...(body.treatmentRef !== undefined ? { treatmentRef: body.treatmentRef } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.recordedDate !== undefined
        ? { recordedDate: parseBusinessDate(body.recordedDate) }
        : {}),
      ...(body.farmRef !== undefined ? { farmRef: body.farmRef } : {}),
    });

    return toHealthRecordDto(row);
  }

  async deleteHealthRecord(customerId: string, livestockId: string, id: string): Promise<void> {
    await assertLivestockOwned(customerId, livestockId);

    const existing = await this.repo.findHealthRecordById(customerId, livestockId, id);
    if (!existing) throw new LivestockHealthNotFoundError('Health record not found');

    await this.repo.deleteHealthRecord(id);
  }

  async listVaccinations(
    customerId: string,
    livestockId: string,
    query: VaccinationListQuery,
  ): Promise<PaginatedVaccinationsDto> {
    await assertLivestockOwned(customerId, livestockId);

    const skip = (query.page - 1) * query.limit;
    const listParams = {
      customerId,
      livestockId,
      skip,
      take: query.limit,
      ...(query.status ? { status: query.status } : {}),
    };
    const from = parseDateParam(query.from);
    const to = parseDateParam(query.to);
    if (from) Object.assign(listParams, { from });
    if (to) Object.assign(listParams, { to });

    const { rows, total } = await this.repo.listVaccinations(listParams);

    return {
      items: rows.map(toVaccinationDto),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async createVaccination(
    customerId: string,
    livestockId: string,
    body: CreateVaccinationBody,
    actorUserId?: string,
  ): Promise<VaccinationDto> {
    const livestock = await assertLivestockOwned(customerId, livestockId);

    const row = await this.repo.createVaccination({
      customerId,
      livestock: { connect: { id: livestockId } },
      farmRef: body.farmRef ?? livestock.farmRef,
      vaccineName: body.vaccineName,
      vaccineType: body.vaccineType ?? null,
      scheduledDate: parseBusinessDate(body.scheduledDate),
      nextDueDate: body.nextDueDate ? parseBusinessDate(body.nextDueDate) : null,
      batchNumber: body.batchNumber ?? null,
      notes: body.notes ?? null,
      status: LivestockVaccinationStatus.SCHEDULED,
    });

    await writeLivestockAudit(
      customerId,
      'VACCINATION_CREATED',
      'LivestockVaccination',
      row.id,
      actorUserId,
      { livestockId, vaccineName: row.vaccineName },
    );

    return toVaccinationDto(row);
  }

  async getVaccinationById(
    customerId: string,
    livestockId: string,
    id: string,
  ): Promise<VaccinationDto> {
    await assertLivestockOwned(customerId, livestockId);

    const row = await this.repo.findVaccinationById(customerId, livestockId, id);
    if (!row) throw new LivestockHealthNotFoundError('Vaccination not found');
    return toVaccinationDto(row);
  }

  async updateVaccination(
    customerId: string,
    livestockId: string,
    id: string,
    body: UpdateVaccinationBody,
  ): Promise<VaccinationDto> {
    await assertLivestockOwned(customerId, livestockId);

    const existing = await this.repo.findVaccinationById(customerId, livestockId, id);
    if (!existing) throw new LivestockHealthNotFoundError('Vaccination not found');

    const row = await this.repo.updateVaccination(id, {
      ...(body.vaccineName !== undefined ? { vaccineName: body.vaccineName } : {}),
      ...(body.vaccineType !== undefined ? { vaccineType: body.vaccineType } : {}),
      ...(body.scheduledDate !== undefined
        ? { scheduledDate: parseBusinessDate(body.scheduledDate) }
        : {}),
      ...(body.nextDueDate !== undefined
        ? { nextDueDate: body.nextDueDate ? parseBusinessDate(body.nextDueDate) : null }
        : {}),
      ...(body.batchNumber !== undefined ? { batchNumber: body.batchNumber } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.farmRef !== undefined ? { farmRef: body.farmRef } : {}),
    });

    return toVaccinationDto(row);
  }

  async markVaccinationCompleted(
    customerId: string,
    livestockId: string,
    id: string,
    body: MarkVaccinationCompletedBody = {},
  ): Promise<VaccinationDto> {
    await assertLivestockOwned(customerId, livestockId);

    const existing = await this.repo.findVaccinationById(customerId, livestockId, id);
    if (!existing) throw new LivestockHealthNotFoundError('Vaccination not found');

    const administeredDate = body.administeredDate
      ? parseBusinessDate(body.administeredDate)
      : new Date();

    const row = await this.repo.updateVaccination(id, {
      status: LivestockVaccinationStatus.COMPLETED,
      administeredDate,
      ...(body.batchNumber !== undefined ? { batchNumber: body.batchNumber } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.nextDueDate !== undefined
        ? { nextDueDate: body.nextDueDate ? parseBusinessDate(body.nextDueDate) : null }
        : {}),
    });

    return toVaccinationDto(row);
  }
}

let serviceSingleton: LivestockHealthService | undefined;

export function getLivestockHealthService(): LivestockHealthService {
  if (!serviceSingleton) {
    serviceSingleton = new LivestockHealthService();
  }
  return serviceSingleton;
}

export function mapLivestockHealthError(
  e: unknown,
): { code: string; status: number; message: string } | null {
  if (e instanceof OwnershipError) {
    return {
      code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'FORBIDDEN',
      status: e.code === 'NOT_FOUND' ? 404 : 403,
      message: e.message,
    };
  }
  if (e instanceof LivestockHealthNotFoundError) {
    return { code: 'NOT_FOUND', status: 404, message: e.message };
  }
  return null;
}

export { OwnershipError };
