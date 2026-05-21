import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateAnimalDto, UpdateAnimalDto, CreateMedicalRecordDto } from './animals.dto.js';
import type { Animal, AnimalFilter, AnimalMedicalRecord } from './animals.types.js';

export interface AnimalsRepositoryInterface extends ModuleService {
  create(data: CreateAnimalDto): Promise<Animal>;
  findById(id: string): Promise<Animal | null>;
  findByOwner(ownerId: string): Promise<Animal[]>;
  update(id: string, data: UpdateAnimalDto): Promise<Animal>;
  delete(id: string): Promise<void>;
  list(filter: AnimalFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Animal>>;
  getMedicalRecords(animalId: string): Promise<AnimalMedicalRecord[]>;
  addMedicalRecord(data: CreateMedicalRecordDto): Promise<AnimalMedicalRecord>;
}

export class AnimalsRepository implements AnimalsRepositoryInterface {
  readonly name = 'AnimalsRepository';

  async create(_data: CreateAnimalDto): Promise<Animal> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async findById(_id: string): Promise<Animal | null> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async findByOwner(_ownerId: string): Promise<Animal[]> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async update(_id: string, _data: UpdateAnimalDto): Promise<Animal> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async list(_filter: AnimalFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Animal>> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async getMedicalRecords(_animalId: string): Promise<AnimalMedicalRecord[]> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async addMedicalRecord(_data: CreateMedicalRecordDto): Promise<AnimalMedicalRecord> {
    throw new Error('Not implemented - awaiting database migration');
  }
}

