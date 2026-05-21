import { z } from 'zod';

import { cuidSchema, paginationSchema } from '../../shared/validation/index.js';

const specializationEnum = z.enum([
  'GENERAL',
  'CATTLE',
  'POULTRY',
  'PET',
  'AQUACULTURE',
  'EQUINE',
  'EXOTIC',
  'SURGERY',
  'EMERGENCY',
]);

const verificationStatusEnum = z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']);
const availabilityStatusEnum = z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']);

export const createDoctorSchema = z.object({
  userId: cuidSchema,
  clinicId: cuidSchema.optional(),
  specialization: z.array(specializationEnum).min(1),
  licenseNumber: z.string().min(5).max(50),
  yearsExperience: z.number().int().min(0).max(60),
  bio: z.string().max(1000).optional(),
});

export const updateDoctorSchema = z.object({
  specialization: z.array(specializationEnum).min(1).optional(),
  bio: z.string().max(1000).optional(),
  availabilityStatus: availabilityStatusEnum.optional(),
});

export const verifyDoctorSchema = z.object({
  status: verificationStatusEnum,
  reason: z.string().max(500).optional(),
});

export const doctorScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().default(true),
});

export const doctorFilterSchema = z.object({
  specialization: specializationEnum.optional(),
  verificationStatus: verificationStatusEnum.optional(),
  availabilityStatus: availabilityStatusEnum.optional(),
  clinicId: cuidSchema.optional(),
  search: z.string().max(100).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
}).merge(paginationSchema);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type VerifyDoctorInput = z.infer<typeof verifyDoctorSchema>;
export type DoctorScheduleInput = z.infer<typeof doctorScheduleSchema>;
export type DoctorFilterInput = z.infer<typeof doctorFilterSchema>;
