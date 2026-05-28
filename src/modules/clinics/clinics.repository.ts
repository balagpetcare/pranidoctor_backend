import { throwFoundationNotImplemented } from '../../shared/errors/index.js';
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
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async findById(_id: string): Promise<Clinic | null> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async findBySlug(_slug: string): Promise<Clinic | null> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async findByOwner(_ownerId: string): Promise<Clinic[]> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async update(_id: string, _data: UpdateClinicDto): Promise<Clinic> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async list(_filter: ClinicFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Clinic>> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async getServices(_clinicId: string): Promise<ClinicService[]> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async addService(_data: CreateClinicServiceDto): Promise<ClinicService> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async removeService(_serviceId: string): Promise<void> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async getStaff(_clinicId: string): Promise<ClinicStaff[]> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async addStaff(_data: AddStaffDto): Promise<ClinicStaff> {
    throwFoundationNotImplemented('Clinics foundation API');
  }

  async removeStaff(_staffId: string): Promise<void> {
    throwFoundationNotImplemented('Clinics foundation API');
  }
}


