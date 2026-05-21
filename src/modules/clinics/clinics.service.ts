import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateClinicDto, UpdateClinicDto, CreateClinicServiceDto, AddStaffDto } from './clinics.dto.js';
import { clinicsEvents } from './clinics.events.js';
import type { ClinicsRepositoryInterface } from './clinics.repository.js';
import type { Clinic, ClinicFilter, ClinicService, ClinicStaff } from './clinics.types.js';

export interface ClinicsServiceInterface extends ModuleService {
  create(data: CreateClinicDto): Promise<Clinic>;
  findById(id: string): Promise<Clinic | null>;
  findBySlug(slug: string): Promise<Clinic | null>;
  findByOwner(ownerId: string): Promise<Clinic[]>;
  update(id: string, data: UpdateClinicDto): Promise<Clinic>;
  list(filter: ClinicFilter, page: number, pageSize: number): Promise<PaginatedResult<Clinic>>;
  getServices(clinicId: string): Promise<ClinicService[]>;
  addService(data: CreateClinicServiceDto): Promise<ClinicService>;
  removeService(serviceId: string): Promise<void>;
  getStaff(clinicId: string): Promise<ClinicStaff[]>;
  addStaff(data: AddStaffDto): Promise<ClinicStaff>;
  removeStaff(staffId: string): Promise<void>;
}

export class ClinicsService implements ClinicsServiceInterface {
  readonly name = 'ClinicsService';

  constructor(private readonly repository: ClinicsRepositoryInterface) {}

  async create(data: CreateClinicDto): Promise<Clinic> {
    const clinic = await this.repository.create(data);

    await clinicsEvents.emitClinicCreated({
      clinicId: clinic.id,
      ownerId: clinic.ownerId,
      name: clinic.name,
      timestamp: new Date(),
    });

    return clinic;
  }

  async findById(id: string): Promise<Clinic | null> {
    return this.repository.findById(id);
  }

  async findBySlug(slug: string): Promise<Clinic | null> {
    return this.repository.findBySlug(slug);
  }

  async findByOwner(ownerId: string): Promise<Clinic[]> {
    return this.repository.findByOwner(ownerId);
  }

  async update(id: string, data: UpdateClinicDto): Promise<Clinic> {
    const clinic = await this.repository.update(id, data);

    await clinicsEvents.emitClinicUpdated({
      clinicId: clinic.id,
      changes: Object.keys(data),
      timestamp: new Date(),
    });

    return clinic;
  }

  async list(filter: ClinicFilter, page: number, pageSize: number): Promise<PaginatedResult<Clinic>> {
    return this.repository.list(filter, page, pageSize);
  }

  async getServices(clinicId: string): Promise<ClinicService[]> {
    return this.repository.getServices(clinicId);
  }

  async addService(data: CreateClinicServiceDto): Promise<ClinicService> {
    return this.repository.addService(data);
  }

  async removeService(serviceId: string): Promise<void> {
    return this.repository.removeService(serviceId);
  }

  async getStaff(clinicId: string): Promise<ClinicStaff[]> {
    return this.repository.getStaff(clinicId);
  }

  async addStaff(data: AddStaffDto): Promise<ClinicStaff> {
    return this.repository.addStaff(data);
  }

  async removeStaff(staffId: string): Promise<void> {
    return this.repository.removeStaff(staffId);
  }
}
