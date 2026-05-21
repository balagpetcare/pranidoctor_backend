import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateClinicDto, UpdateClinicDto, CreateClinicServiceDto, AddStaffDto } from './clinics.dto.js';
import type { Clinic, ClinicFilter, ClinicService, ClinicStaff } from './clinics.types.js';

export interface ClinicsRepositoryInterface extends ModuleService {
  create(data: CreateClinicDto): Promise<Clinic>;
  findById(id: string): Promise<Clinic | null>;
  findBySlug(slug: string): Promise<Clinic | null>;
  findByOwner(ownerId: string): Promise<Clinic[]>;
  update(id: string, data: UpdateClinicDto): Promise<Clinic>;
  list(filter: ClinicFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Clinic>>;
  getServices(_clinicId: string): Promise<ClinicService[]>;
  addService(data: CreateClinicServiceDto): Promise<ClinicService>;
  removeService(_serviceId: string): Promise<void>;
  getStaff(_clinicId: string): Promise<ClinicStaff[]>;
  addStaff(data: AddStaffDto): Promise<ClinicStaff>;
  removeStaff(_staffId: string): Promise<void>;
}

export class ClinicsRepository implements ClinicsRepositoryInterface {
  readonly name = 'ClinicsRepository';

  async create(_data: CreateClinicDto): Promise<Clinic> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async findById(_id: string): Promise<Clinic | null> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async findBySlug(_slug: string): Promise<Clinic | null> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async findByOwner(_ownerId: string): Promise<Clinic[]> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async update(_id: string, _data: UpdateClinicDto): Promise<Clinic> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async list(_filter: ClinicFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Clinic>> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async getServices(_clinicId: string): Promise<ClinicService[]> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async addService(_data: CreateClinicServiceDto): Promise<ClinicService> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async removeService(_serviceId: string): Promise<void> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async getStaff(_clinicId: string): Promise<ClinicStaff[]> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async addStaff(_data: AddStaffDto): Promise<ClinicStaff> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async removeStaff(_staffId: string): Promise<void> {
    throw new Error('Not implemented - awaiting database migration');
  }
}


