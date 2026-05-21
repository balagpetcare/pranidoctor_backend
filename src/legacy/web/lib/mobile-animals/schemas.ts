import { z } from "zod";

import {
  AnimalCategory,
  AnimalType,
  Gender,
  PregnancyStatus,
} from "@/generated/prisma/client";

const animalTypeSchema = z.nativeEnum(AnimalType);
const genderSchema = z.nativeEnum(Gender);
const animalCategorySchema = z.nativeEnum(AnimalCategory);
const pregnancyStatusSchema = z.nativeEnum(PregnancyStatus);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional();

const optionalPhotoUrl = z
  .union([
    z.string().trim().url().max(2000),
    z.literal(""),
  ])
  .optional();

export const listAnimalsQuerySchema = z.object({
  includeInactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const createAnimalBodySchema = z
  .object({
    animalType: animalTypeSchema,
    category: animalCategorySchema.optional(),
    name: optionalTrimmed(120),
    tag: optionalTrimmed(120),
    breed: optionalTrimmed(200),
    dateOfBirth: z.string().trim().optional(),
    ageYears: z.coerce.number().int().min(0).max(80).optional(),
    sex: optionalTrimmed(64),
    gender: genderSchema.optional(),
    pregnancyStatus: pregnancyStatusSchema.optional(),
    notes: optionalTrimmed(8000),
    photoUrl: optionalPhotoUrl,
    weightKg: z.coerce.number().positive().max(99999).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const nameOk = data.name != null && data.name.length > 0;
    const tagOk = data.tag != null && data.tag.length > 0;
    if (!nameOk && !tagOk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either name or tag is required",
        path: ["name"],
      });
    }
    if (data.dateOfBirth != null && data.ageYears != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only one of dateOfBirth or ageYears",
        path: ["dateOfBirth"],
      });
    }
    if (data.dateOfBirth != null) {
      const d = new Date(data.dateOfBirth);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "dateOfBirth must be a valid ISO date string",
          path: ["dateOfBirth"],
        });
      } else if (d > new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "dateOfBirth cannot be in the future",
          path: ["dateOfBirth"],
        });
      }
    }
  });

export const patchAnimalBodySchema = z
  .object({
    animalType: animalTypeSchema.optional(),
    category: animalCategorySchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    tag: z.string().trim().max(120).nullable().optional(),
    breed: z.string().trim().max(200).nullable().optional(),
    dateOfBirth: z.string().trim().nullable().optional(),
    ageYears: z
      .union([z.number().int().min(0).max(80), z.null()])
      .optional(),
    sex: z.string().trim().max(64).nullable().optional(),
    gender: genderSchema.nullable().optional(),
    pregnancyStatus: pregnancyStatusSchema.nullable().optional(),
    notes: z.string().trim().max(8000).nullable().optional(),
    photoUrl: z.union([z.string().trim().url().max(2000), z.literal("")]).nullable().optional(),
    weightKg: z
      .union([z.number().positive().max(99999), z.null()])
      .optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasDob =
      data.dateOfBirth !== undefined &&
      data.dateOfBirth !== null &&
      String(data.dateOfBirth).trim() !== "";
    const hasAge = data.ageYears !== undefined && data.ageYears !== null;
    if (hasDob && hasAge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only one of dateOfBirth or ageYears",
        path: ["dateOfBirth"],
      });
    }
    if (data.dateOfBirth !== undefined && data.dateOfBirth !== null) {
      const s = String(data.dateOfBirth).trim();
      if (s !== "") {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "dateOfBirth must be a valid ISO date string",
            path: ["dateOfBirth"],
          });
        } else if (d > new Date()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "dateOfBirth cannot be in the future",
            path: ["dateOfBirth"],
          });
        }
      }
    }
  });

export type CreateAnimalBody = z.infer<typeof createAnimalBodySchema>;
export type PatchAnimalBody = z.infer<typeof patchAnimalBodySchema>;
