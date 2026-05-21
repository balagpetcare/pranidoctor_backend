import { z } from "zod";

import { AnimalType } from "@/generated/prisma/client";

const nonNegDecimal = z.union([
  z.number().nonnegative(),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "সঠিক দশমিক মূল্য দিন"),
]);

const optionalTrim = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable();

export const createServiceFromTemplateBodySchema = z
  .object({
    templateId: z.string().trim().min(1),
    basePrice: nonNegDecimal.optional().nullable(),
    offerPrice: nonNegDecimal.optional().nullable(),
    discountPercent: z
      .union([
        z.number().min(0).max(100),
        z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,2})?$/)
          .transform((s) => Number(s)),
      ])
      .optional()
      .nullable(),
    visitFee: nonNegDecimal.optional().nullable(),
    emergencyFee: nonNegDecimal.optional().nullable(),
    technicianServiceNote: optionalTrim(8000),
    isAvailable: z.boolean().optional(),
    initialInventoryLot: z
      .object({
        currentQuantity: z.number().int().min(0),
        reservedQuantity: z.number().int().min(0).optional(),
        usedQuantity: z.number().int().min(0).optional(),
        minStockAlert: z.number().int().min(0).optional().nullable(),
        batchNumber: optionalTrim(120),
        expiryDate: z.string().trim().max(40).optional().nullable(),
        sourceNote: optionalTrim(2000),
        storageNote: optionalTrim(2000),
      })
      .strict()
      .optional()
      .nullable(),
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
    if (b.initialInventoryLot) {
      const r = b.initialInventoryLot.reservedQuantity ?? 0;
      if (r > b.initialInventoryLot.currentQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["initialInventoryLot", "reservedQuantity"],
          message: "reservedQuantity cannot exceed currentQuantity",
        });
      }
    }
  });

export type CreateServiceFromTemplateBody = z.infer<typeof createServiceFromTemplateBodySchema>;

export const listSemenTemplatesQuerySchema = z
  .object({
    animalType: z.nativeEnum(AnimalType).optional(),
    providerId: z.string().trim().optional(),
    breedId: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(30),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export const createSemenInventoryLotBodySchema = z
  .object({
    currentQuantity: z.number().int().min(0),
    reservedQuantity: z.number().int().min(0).optional(),
    usedQuantity: z.number().int().min(0).optional(),
    minStockAlert: z.number().int().min(0).optional().nullable(),
    batchNumber: optionalTrim(120),
    expiryDate: z.string().trim().max(40).optional().nullable(),
    sourceNote: optionalTrim(2000),
    storageNote: optionalTrim(2000),
  })
  .strict();

export const patchSemenInventoryLotBodySchema = createSemenInventoryLotBodySchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });
