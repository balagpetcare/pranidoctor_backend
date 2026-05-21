import { z } from "zod";

import { AnimalType } from "@/generated/prisma/client";

const optionalTrim = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable();

const nonNegDecimal = z.union([
  z.number().nonnegative(),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "সঠিক দশমিক মূল্য দিন"),
]);

export const createAiTechnicianServiceBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    animalType: z.nativeEnum(AnimalType),
    breedOrSemenType: optionalTrim(200),
    description: optionalTrim(8000),
    basePrice: nonNegDecimal,
    visitFee: nonNegDecimal.optional().nullable(),
    emergencyFee: nonNegDecimal.optional().nullable(),
    repeatServicePolicy: optionalTrim(4000),
    followUpIncluded: z.boolean().optional(),
  })
  .strict();

export type CreateAiTechnicianServiceBody = z.infer<
  typeof createAiTechnicianServiceBodySchema
>;

export const patchAiTechnicianServiceBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    animalType: z.nativeEnum(AnimalType).optional(),
    breedOrSemenType: optionalTrim(200),
    description: optionalTrim(8000),
    basePrice: nonNegDecimal.optional(),
    visitFee: nonNegDecimal.optional().nullable(),
    emergencyFee: nonNegDecimal.optional().nullable(),
    repeatServicePolicy: optionalTrim(4000),
    followUpIncluded: z.boolean().optional(),
  })
  .strict();

export type PatchAiTechnicianServiceBody = z.infer<
  typeof patchAiTechnicianServiceBodySchema
>;

/** Technician-editable fields only (template-backed services, any editable status). */
export const patchTemplateBackedAiTechnicianServiceBodySchema = z
  .object({
    basePrice: nonNegDecimal.optional(),
    visitFee: nonNegDecimal.optional().nullable(),
    emergencyFee: nonNegDecimal.optional().nullable(),
    offerPrice: nonNegDecimal.optional().nullable(),
    discountPercent: z
      .union([
        z.number().min(0).max(100),
        z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,2})?$/, "সঠিক দশমিক মূল্য দিন"),
      ])
      .optional()
      .nullable(),
    isAvailable: z.boolean().optional(),
    technicianServiceNote: optionalTrim(8000),
    repeatServicePolicy: optionalTrim(4000),
    followUpIncluded: z.boolean().optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const hasOffer = b.offerPrice != null && String(b.offerPrice).trim() !== "";
    const hasDisc = b.discountPercent != null && String(b.discountPercent).trim() !== "";
    if (hasOffer && hasDisc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offerPrice এবং discountPercent একসাথে দেওয়া যাবে না",
      });
    }
  });

export type PatchTemplateBackedAiTechnicianServiceBody = z.infer<
  typeof patchTemplateBackedAiTechnicianServiceBodySchema
>;

export const patchAiTechnicianSettingsBodySchema = z
  .object({
    acceptsEmergency: z.boolean(),
  })
  .strict();

export type PatchAiTechnicianSettingsBody = z.infer<
  typeof patchAiTechnicianSettingsBodySchema
>;
