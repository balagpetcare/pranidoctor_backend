import { z } from 'zod';

import { cuidSchema, paginationSchema } from '../../shared/validation/index.js';

const speciesEnum = z.enum([
  'CATTLE', 'GOAT', 'SHEEP', 'POULTRY', 'DOG', 'CAT',
  'FISH', 'BIRD', 'HORSE', 'BUFFALO', 'PIG', 'RABBIT', 'OTHER',
]);
const genderEnum = z.enum(['MALE', 'FEMALE', 'UNKNOWN']);
const statusEnum = z.enum(['ACTIVE', 'DECEASED', 'SOLD', 'TRANSFERRED']);
const recordTypeEnum = z.enum([
  'VACCINATION', 'TREATMENT', 'SURGERY', 'CHECKUP',
  'DIAGNOSIS', 'PRESCRIPTION', 'LAB_RESULT', 'OTHER',
]);

export const createAnimalSchema = z.object({
  ownerId: cuidSchema,
  name: z.string().min(1).max(100),
  species: speciesEnum,
  breed: z.string().max(100).optional(),
  gender: genderEnum,
  dateOfBirth: z.coerce.date().optional(),
  weight: z.number().positive().max(10000).optional(),
  color: z.string().max(50).optional(),
  microchipId: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateAnimalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  breed: z.string().max(100).optional(),
  weight: z.number().positive().max(10000).optional(),
  color: z.string().max(50).optional(),
  microchipId: z.string().max(50).optional(),
  status: statusEnum.optional(),
  notes: z.string().max(2000).optional(),
});

export const createMedicalRecordSchema = z.object({
  animalId: cuidSchema,
  recordType: recordTypeEnum,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  date: z.coerce.date(),
  doctorId: cuidSchema.optional(),
  attachments: z.array(z.string().url()).max(10).optional(),
});

export const animalFilterSchema = z.object({
  ownerId: cuidSchema.optional(),
  species: speciesEnum.optional(),
  status: statusEnum.optional(),
  search: z.string().max(100).optional(),
}).merge(paginationSchema);

export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;
export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;
export type AnimalFilterInput = z.infer<typeof animalFilterSchema>;
