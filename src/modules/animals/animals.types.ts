export interface Animal {
  id: string;
  ownerId: string;
  name: string;
  species: AnimalSpecies;
  breed?: string;
  gender: AnimalGender;
  dateOfBirth?: Date;
  weight?: number;
  color?: string;
  microchipId?: string;
  status: AnimalStatus;
  notes?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AnimalSpecies =
  | 'CATTLE'
  | 'GOAT'
  | 'SHEEP'
  | 'POULTRY'
  | 'DOG'
  | 'CAT'
  | 'FISH'
  | 'BIRD'
  | 'HORSE'
  | 'BUFFALO'
  | 'PIG'
  | 'RABBIT'
  | 'OTHER';

export type AnimalGender = 'MALE' | 'FEMALE' | 'UNKNOWN';

export type AnimalStatus = 'ACTIVE' | 'DECEASED' | 'SOLD' | 'TRANSFERRED';

export interface AnimalMedicalRecord {
  id: string;
  animalId: string;
  recordType: MedicalRecordType;
  title: string;
  description?: string;
  date: Date;
  doctorId?: string;
  attachments?: string[];
  createdAt: Date;
}

export type MedicalRecordType =
  | 'VACCINATION'
  | 'TREATMENT'
  | 'SURGERY'
  | 'CHECKUP'
  | 'DIAGNOSIS'
  | 'PRESCRIPTION'
  | 'LAB_RESULT'
  | 'OTHER';

export interface AnimalFilter {
  ownerId?: string;
  species?: AnimalSpecies;
  status?: AnimalStatus;
  search?: string;
}
