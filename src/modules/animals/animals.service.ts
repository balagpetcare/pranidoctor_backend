import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateAnimalDto, UpdateAnimalDto, CreateMedicalRecordDto } from './animals.dto.js';
import { animalsEvents } from './animals.events.js';
import type { AnimalsRepositoryInterface } from './animals.repository.js';
import type { Animal, AnimalFilter, AnimalMedicalRecord } from './animals.types.js';

export interface AnimalsServiceInterface extends ModuleService {
  create(data: CreateAnimalDto): Promise<Animal>;
  findById(id: string): Promise<Animal | null>;
  findByOwner(ownerId: string): Promise<Animal[]>;
  update(id: string, data: UpdateAnimalDto): Promise<Animal>;
  delete(id: string): Promise<void>;
  list(filter: AnimalFilter, page: number, pageSize: number): Promise<PaginatedResult<Animal>>;
  getMedicalRecords(animalId: string): Promise<AnimalMedicalRecord[]>;
  addMedicalRecord(data: CreateMedicalRecordDto): Promise<AnimalMedicalRecord>;
}

export class AnimalsService implements AnimalsServiceInterface {
  readonly name = 'AnimalsService';

  constructor(private readonly repository: AnimalsRepositoryInterface) {}

  async create(data: CreateAnimalDto): Promise<Animal> {
    const animal = await this.repository.create(data);

    await animalsEvents.emitAnimalCreated({
      animalId: animal.id,
      ownerId: animal.ownerId,
      species: animal.species,
      timestamp: new Date(),
    });

    return animal;
  }

  async findById(id: string): Promise<Animal | null> {
    return this.repository.findById(id);
  }

  async findByOwner(ownerId: string): Promise<Animal[]> {
    return this.repository.findByOwner(ownerId);
  }

  async update(id: string, data: UpdateAnimalDto): Promise<Animal> {
    const animal = await this.repository.update(id, data);

    await animalsEvents.emitAnimalUpdated({
      animalId: animal.id,
      changes: Object.keys(data),
      timestamp: new Date(),
    });

    return animal;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async list(filter: AnimalFilter, page: number, pageSize: number): Promise<PaginatedResult<Animal>> {
    return this.repository.list(filter, page, pageSize);
  }

  async getMedicalRecords(animalId: string): Promise<AnimalMedicalRecord[]> {
    return this.repository.getMedicalRecords(animalId);
  }

  async addMedicalRecord(data: CreateMedicalRecordDto): Promise<AnimalMedicalRecord> {
    return this.repository.addMedicalRecord(data);
  }
}
