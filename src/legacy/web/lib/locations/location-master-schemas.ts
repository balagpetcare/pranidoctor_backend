import { z } from "zod";

export const locationSearchLevelSchema = z.enum([
  "DIVISION",
  "DISTRICT",
  "UPAZILA",
  "UNION",
  "VILLAGE",
  "ALL",
]);

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
    upazilaId: z.string().cuid(),
  })
  .strict();

export const listVillagesQuerySchema = z
  .object({
    unionId: z.string().cuid(),
  })
  .strict();

export const locationSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    level: locationSearchLevelSchema.optional().default("ALL"),
  })
  .strict();

export const locationTreeQuerySchema = z
  .object({
    divisionId: z.string().cuid().optional(),
    districtId: z.string().cuid().optional(),
    upazilaId: z.string().cuid().optional(),
    unionId: z.string().cuid().optional(),
  })
  .strict();

export const adminLocationLevelSchema = z.enum([
  "DIVISION",
  "DISTRICT",
  "UPAZILA",
  "UNION",
  "VILLAGE",
  "ALL",
]);

export const adminLocationListQuerySchema = z
  .object({
    level: adminLocationLevelSchema,
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  })
  .strict();
