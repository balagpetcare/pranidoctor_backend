import { PrescriptionStatus } from '@/generated/prisma/client';
import { z } from 'zod';

export const adminPrescriptionSortSchema = z.enum([
  'createdAt_desc',
  'createdAt_asc',
  'validUntil_desc',
  'validUntil_asc',
  'updatedAt_desc',
]);

export const adminListPrescriptionsQuerySchema = z.object({
  status: z.nativeEnum(PrescriptionStatus).optional(),
  serviceRequestId: z.string().min(1).optional(),
  doctorId: z.string().min(1).optional(),
  animalId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sort: adminPrescriptionSortSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type AdminListPrescriptionsQuery = z.infer<typeof adminListPrescriptionsQuerySchema>;

export function parseAdminListPrescriptionsQuery(searchParams: URLSearchParams) {
  return adminListPrescriptionsQuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    serviceRequestId: searchParams.get('serviceRequestId') ?? undefined,
    doctorId: searchParams.get('doctorId') ?? undefined,
    animalId: searchParams.get('animalId') ?? undefined,
    customerId: searchParams.get('customerId') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  });
}
