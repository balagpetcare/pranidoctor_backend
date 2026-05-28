import { throwFoundationNotImplemented } from '../../shared/errors/index.js';
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
    throwFoundationNotImplemented('Animals foundation API');
  }

  async findById(_id: string): Promise<Animal | null> {
    throwFoundationNotImplemented('Animals foundation API');
  }

  async findByOwner(_ownerId: string): Promise<Animal[]> {
    throwFoundationNotImplemented('Animals foundation API');
  }

  async update(_id: string, _data: UpdateAnimalDto): Promise<Animal> {
    throwFoundationNotImplemented('Animals foundation API');
  }

  async delete(_id: string): Promise<void> {
    throwFoundationNotImplemented('Animals foundation API');
  }

  async list(_filter: AnimalFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Animal>> {
    throwFoundationNotImplemented('Animals foundation API');
  }

  async getMedicalRecords(_animalId: string): Promise<AnimalMedicalRecord[]> {
    throwFoundationNotImplemented('Animals foundation API');
  }

  async addMedicalRecord(_data: CreateMedicalRecordDto): Promise<AnimalMedicalRecord> {
    throwFoundationNotImplemented('Animals foundation API');
  }
}

