import { z } from "zod";

export const listDistrictsQuerySchema = z
  .object({
    divisionId: z.string().cuid().optional(),
  })
  .strict();

export const listUpazilasQuerySchema = z
  .object({
    districtId: z.string().cuid(),
  })
  .strict();

export const listUnionsQuerySchema = z
  .object({
    districtId: z.string().cuid(),
    upazilaId: z.string().cuid(),
  })
  .strict();

export const listVillagesQuerySchema = z
  .object({
    unionId: z.string().cuid(),
  })
  .strict();

export const mobileLocationSearchLevelSchema = z.enum([
  "DIVISION",
  "DISTRICT",
  "UPAZILA",
  "UNION",
  "VILLAGE",
  "ALL",
]);

export const searchLocationsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(50).optional().default(25),
    level: mobileLocationSearchLevelSchema.optional(),
  })
  .strict();

export type ListDistrictsQuery = z.infer<typeof listDistrictsQuerySchema>;
export type ListUpazilasQuery = z.infer<typeof listUpazilasQuerySchema>;
export type ListUnionsQuery = z.infer<typeof listUnionsQuerySchema>;
export type ListVillagesQuery = z.infer<typeof listVillagesQuerySchema>;
export type SearchLocationsQuery = z.infer<typeof searchLocationsQuerySchema>;
