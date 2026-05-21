import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateDoctorDto, UpdateDoctorDto, DoctorScheduleDto, VerifyDoctorDto } from './doctors.dto.js';
import { doctorsEvents } from './doctors.events.js';
import type { DoctorsRepositoryInterface } from './doctors.repository.js';
import type { Doctor, DoctorFilter, DoctorSchedule } from './doctors.types.js';

export interface DoctorsServiceInterface extends ModuleService {
  create(data: CreateDoctorDto): Promise<Doctor>;
  findById(id: string): Promise<Doctor | null>;
  findByUserId(userId: string): Promise<Doctor | null>;
  update(id: string, data: UpdateDoctorDto): Promise<Doctor>;
  verify(id: string, data: VerifyDoctorDto): Promise<Doctor>;
  list(filter: DoctorFilter, page: number, pageSize: number): Promise<PaginatedResult<Doctor>>;
  getSchedule(doctorId: string): Promise<DoctorSchedule[]>;
  setSchedule(doctorId: string, schedules: DoctorScheduleDto[]): Promise<DoctorSchedule[]>;
}

export class DoctorsService implements DoctorsServiceInterface {
  readonly name = 'DoctorsService';

  constructor(private readonly repository: DoctorsRepositoryInterface) {}

  async create(data: CreateDoctorDto): Promise<Doctor> {
    const doctor = await this.repository.create(data);

    await doctorsEvents.emitDoctorCreated({
      doctorId: doctor.id,
      userId: doctor.userId,
      specialization: doctor.specialization,
      timestamp: new Date(),
    });

    return doctor;
  }

  async findById(id: string): Promise<Doctor | null> {
    return this.repository.findById(id);
  }

  async findByUserId(userId: string): Promise<Doctor | null> {
    return this.repository.findByUserId(userId);
  }

  async update(id: string, data: UpdateDoctorDto): Promise<Doctor> {
    const doctor = await this.repository.update(id, data);

    await doctorsEvents.emitDoctorUpdated({
      doctorId: doctor.id,
      changes: Object.keys(data),
      timestamp: new Date(),
    });

    return doctor;
  }

  async verify(id: string, data: VerifyDoctorDto): Promise<Doctor> {
    const doctor = await this.repository.updateVerification(id, data.status, data.reason);

    if (data.status === 'VERIFIED') {
      await doctorsEvents.emitDoctorVerified({
        doctorId: doctor.id,
        userId: doctor.userId,
        timestamp: new Date(),
      });
    }

    return doctor;
  }

  async list(filter: DoctorFilter, page: number, pageSize: number): Promise<PaginatedResult<Doctor>> {
    return this.repository.list(filter, page, pageSize);
  }

  async getSchedule(doctorId: string): Promise<DoctorSchedule[]> {
    return this.repository.getSchedule(doctorId);
  }

  async setSchedule(doctorId: string, schedules: DoctorScheduleDto[]): Promise<DoctorSchedule[]> {
    return this.repository.setSchedule(doctorId, schedules);
  }
}
