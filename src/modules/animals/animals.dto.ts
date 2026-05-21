import type {
  Animal,
  AnimalSpecies,
  AnimalGender,
  AnimalStatus,
  AnimalMedicalRecord,
  MedicalRecordType,
} from './animals.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface CreateAnimalDto {
  ownerId: string;
  name: string;
  species: AnimalSpecies;
  breed?: string;
  gender: AnimalGender;
  dateOfBirth?: Date;
  weight?: number;
  color?: string;
  microchipId?: string;
  notes?: string;
}

export interface UpdateAnimalDto {
  name?: string;
  breed?: string;
  weight?: number;
  color?: string;
  microchipId?: string;
  status?: AnimalStatus;
  notes?: string;
}

export interface CreateMedicalRecordDto {
  animalId: string;
  recordType: MedicalRecordType;
  title: string;
  description?: string;
  date: Date;
  doctorId?: string;
  attachments?: string[];
}

export interface AnimalResponseDto {
  id: string;
  ownerId: string;
  name: string;
  species: AnimalSpecies;
  breed?: string;
  gender: AnimalGender;
  dateOfBirth?: string;
  weight?: number;
  color?: string;
  microchipId?: string;
  status: AnimalStatus;
  notes?: string;
  createdAt: string;
}

export interface MedicalRecordResponseDto {
  id: string;
  animalId: string;
  recordType: MedicalRecordType;
  title: string;
  description?: string;
  date: string;
  doctorId?: string;
  attachments?: string[];
  createdAt: string;
}

export function toAnimalResponseDto(animal: Animal): AnimalResponseDto {
  return omitUndefined({
    id: animal.id,
    ownerId: animal.ownerId,
    name: animal.name,
    species: animal.species,
    breed: animal.breed,
    gender: animal.gender,
    dateOfBirth: animal.dateOfBirth?.toISOString(),
    weight: animal.weight,
    color: animal.color,
    microchipId: animal.microchipId,
    status: animal.status,
    notes: animal.notes,
    createdAt: animal.createdAt.toISOString(),
  });
}

export function toMedicalRecordResponseDto(record: AnimalMedicalRecord): MedicalRecordResponseDto {
  return omitUndefined({
    id: record.id,
    animalId: record.animalId,
    recordType: record.recordType,
    title: record.title,
    description: record.description,
    date: record.date.toISOString(),
    doctorId: record.doctorId,
    attachments: record.attachments,
    createdAt: record.createdAt.toISOString(),
  });
}
