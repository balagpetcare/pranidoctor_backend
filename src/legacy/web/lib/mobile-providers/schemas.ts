import { z } from "zod";

import { AnimalType } from "@/generated/prisma/client";

const animalTypeSchema = z.nativeEnum(AnimalType);

/** Accepts `CATTLE` or `cattle` from query strings. */
const optionalAnimalTypeFromQuery = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return undefined;
    return t.toUpperCase();
  }
  return v;
}, animalTypeSchema.optional());

/** Blank or malformed → undefined; valid cuid only when present. */
const optionalCuid = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t;
  }
  return v;
}, z.string().cuid().optional());

/** Query booleans: omit param = undefined; `true` / `false` only (strict). */
const boolQuery = z.enum(["true", "false"]).optional().transform((v) => {
  if (v === undefined) return undefined;
  return v === "true";
});

export const listMobileProvidersQuerySchema = z
  .object({
    areaId: optionalCuid,
    areaSlug: z.string().trim().min(1).max(200).optional(),
    animalType: optionalAnimalTypeFromQuery,
    homeVisit: boolQuery,
    emergency: boolQuery,
    onlineConsultation: boolQuery,
    serviceCategoryId: optionalCuid,
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.areaId != null && data.areaSlug != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only one of areaId or areaSlug",
        path: ["areaSlug"],
      });
    }
  });

export type ListMobileProvidersQuery = z.infer<
  typeof listMobileProvidersQuerySchema
>;
