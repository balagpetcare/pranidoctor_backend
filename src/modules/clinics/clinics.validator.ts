import { z } from 'zod';

import { cuidSchema, emailSchema, bdPhoneSchema, paginationSchema } from '../../shared/validation/index.js';

const statusEnum = z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED']);
const staffRoleEnum = z.enum(['OWNER', 'ADMIN', 'DOCTOR', 'TECHNICIAN', 'RECEPTIONIST']);

const geoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const operatingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  isClosed: z.boolean().default(false),
});

export const createClinicSchema = z.object({
  name: z.string().min(2).max(200),
  ownerId: cuidSchema,
  phone: bdPhoneSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().max(500).optional(),
  district: z.string().max(50).optional(),
  division: z.string().max(50).optional(),
  location: geoLocationSchema.optional(),
  services: z.array(z.string().max(100)).max(50).optional(),
});

export const updateClinicSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  phone: bdPhoneSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().max(500).optional(),
  district: z.string().max(50).optional(),
  division: z.string().max(50).optional(),
  location: geoLocationSchema.optional(),
  services: z.array(z.string().max(100)).max(50).optional(),
  status: statusEnum.optional(),
  operatingHours: z.array(operatingHoursSchema).max(7).optional(),
});

export const createClinicServiceSchema = z.object({
  clinicId: cuidSchema,
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive().max(1000000).optional(),
  duration: z.number().int().positive().max(480).optional(),
});

export const addStaffSchema = z.object({
  clinicId: cuidSchema,
  userId: cuidSchema,
  role: staffRoleEnum,
});

export const clinicFilterSchema = z.object({
  status: statusEnum.optional(),
  district: z.string().max(50).optional(),
  division: z.string().max(50).optional(),
  services: z.array(z.string()).optional(),
  search: z.string().max(100).optional(),
  nearLat: z.coerce.number().min(-90).max(90).optional(),
  nearLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
}).merge(paginationSchema);

export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
export type CreateClinicServiceInput = z.infer<typeof createClinicServiceSchema>;
export type AddStaffInput = z.infer<typeof addStaffSchema>;
export type ClinicFilterInput = z.infer<typeof clinicFilterSchema>;
