import { throwFoundationNotImplemented } from '../../shared/errors/index.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';
import { createPaginationMeta } from '../../shared/utils/pagination.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { getDoctorService } from '../doctor/doctor.service.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { ProviderStatus } from '../../generated/prisma/index.js';

import type { CreateDoctorDto, UpdateDoctorDto, DoctorScheduleDto } from './doctors.dto.js';
import type {
  Doctor,
  DoctorFilter,
  DoctorSchedule,
  DoctorVerificationStatus,
} from './doctors.types.js';

export interface DoctorsRepositoryInterface extends ModuleService {
  create(data: CreateDoctorDto): Promise<Doctor>;
  findById(id: string): Promise<Doctor | null>;
  findByUserId(userId: string): Promise<Doctor | null>;
  update(id: string, data: UpdateDoctorDto): Promise<Doctor>;
  updateVerification(id: string, _status: DoctorVerificationStatus, reason?: string): Promise<Doctor>;
  list(filter: DoctorFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Doctor>>;
  getSchedule(_doctorId: string): Promise<DoctorSchedule[]>;
  setSchedule(doctorId: string, _schedules: DoctorScheduleDto[]): Promise<DoctorSchedule[]>;
  incrementConsultations(id: string): Promise<void>;
  updateRating(id: string, _newRating: number): Promise<void>;
}

function mapProviderStatus(status: ProviderStatus): DoctorVerificationStatus {
  switch (status) {
    case ProviderStatus.ACTIVE:
      return 'VERIFIED';
    case ProviderStatus.SUSPENDED:
      return 'SUSPENDED';
    case ProviderStatus.REJECTED:
      return 'REJECTED';
    default:
      return 'PENDING';
  }
}

function toFoundationDoctor(row: {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization: string | null;
  providerStatus: ProviderStatus;
  experienceYears: number | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Doctor {
  return omitUndefined({
    id: row.id,
    userId: row.userId,
    licenseNumber: row.licenseNumber,
    specialization: row.specialization
      ? [row.specialization as Doctor['specialization'][number]]
      : ['GENERAL'],
    yearsExperience: row.experienceYears ?? 0,
    verificationStatus: mapProviderStatus(row.providerStatus),
    totalConsultations: 0,
    availabilityStatus: 'OFFLINE' as const,
    bio: row.bio ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }) as Doctor;
}

export class DoctorsRepository implements DoctorsRepositoryInterface {
  readonly name = 'DoctorsRepository';

  private readonly p2 = getDoctorService();

  async create(_data: CreateDoctorDto): Promise<Doctor> {
    throwFoundationNotImplemented('Doctor registration');
  }

  async findById(id: string): Promise<Doctor | null> {
    const row = await this.p2.findById(id);
    return row ? toFoundationDoctor(row) : null;
  }

  async findByUserId(userId: string): Promise<Doctor | null> {
    const row = await this.p2.findByUserId(userId);
    return row ? toFoundationDoctor(row) : null;
  }

  async update(id: string, data: UpdateDoctorDto): Promise<Doctor> {
    const prisma = getPrisma();
    const updated = await prisma.doctorProfile.update({
      where: { id },
      data: {
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
      },
    });
    return toFoundationDoctor(updated);
  }

  async updateVerification(
    id: string,
    status: DoctorVerificationStatus,
    _reason?: string,
  ): Promise<Doctor> {
    const statusMap: Record<DoctorVerificationStatus, ProviderStatus> = {
      VERIFIED: ProviderStatus.ACTIVE,
      PENDING: ProviderStatus.PENDING_VERIFICATION,
      REJECTED: ProviderStatus.REJECTED,
      SUSPENDED: ProviderStatus.SUSPENDED,
    };
    const updated = await getPrisma().doctorProfile.update({
      where: { id },
      data: { providerStatus: statusMap[status] },
    });
    return toFoundationDoctor(updated);
  }

  async list(
    _filter: DoctorFilter,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<Doctor>> {
    const prisma = getPrisma();
    const [rows, total] = await Promise.all([
      prisma.doctorProfile.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.doctorProfile.count(),
    ]);
    return {
      data: rows.map(toFoundationDoctor),
      meta: createPaginationMeta(total, page, pageSize),
    };
  }

  async getSchedule(_doctorId: string): Promise<DoctorSchedule[]> {
    return [];
  }

  async setSchedule(_doctorId: string, _schedules: DoctorScheduleDto[]): Promise<DoctorSchedule[]> {
    return [];
  }

  async incrementConsultations(_id: string): Promise<void> {
    /* no-op until consultations module */
  }

  async updateRating(_id: string, _newRating: number): Promise<void> {
    /* no-op until ratings module */
  }
}
