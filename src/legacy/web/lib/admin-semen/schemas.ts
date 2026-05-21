import { z } from "zod";

import {
  AnimalType,
  SemenProductKind,
  SemenProviderVerificationStatus,
  SemenTemplateApprovalStatus,
  SemenTemplateMediaKind,
} from "@/generated/prisma/client";

const optionalTrim = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable();

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const listSemenProvidersQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    /** Admin lists may request up to 200 rows (e.g. template form provider picker). */
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export const createSemenProviderBodySchema = z
  .object({
    slug: z.string().trim().min(1).max(80).regex(slugRe, "slug must be lowercase kebab-case"),
    name: z.string().trim().min(1).max(200),
    nameBn: optionalTrim(200),
    description: optionalTrim(8000),
    descriptionBn: optionalTrim(8000),
    logoUploadedFileId: z.string().trim().min(1).optional().nullable(),
    isActive: z.boolean().optional(),
    verificationStatus: z.nativeEnum(SemenProviderVerificationStatus).optional(),
    sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();

export const patchSemenProviderBodySchema = createSemenProviderBodySchema.partial().strict();

export const listLivestockBreedsQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    animalType: z.nativeEnum(AnimalType).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export const createLivestockBreedBodySchema = z
  .object({
    slug: z.string().trim().min(1).max(80).regex(slugRe),
    nameEn: z.string().trim().min(1).max(200),
    nameBn: z.string().trim().min(1).max(200),
    animalType: z.nativeEnum(AnimalType),
    description: optionalTrim(8000),
    isActive: z.boolean().optional(),
  })
  .strict();

export const patchLivestockBreedBodySchema = createLivestockBreedBodySchema.partial().strict();

const breedMixLineSchema = z
  .object({
    breedId: z.string().trim().min(1),
    percentage: z.union([
      z.number().positive().max(100),
      z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/)
        .transform((s) => Number(s)),
    ]),
  })
  .strict();

const externalUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((s) => typeof URL !== "undefined" && URL.canParse(s), "invalid URL")
  .optional()
  .nullable();

const templateMediaLineBaseSchema = z
  .object({
    kind: z.nativeEnum(SemenTemplateMediaKind),
    uploadedFileId: z.string().trim().min(1).optional().nullable(),
    externalUrl: externalUrlSchema,
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

type TemplateMediaLineBase = z.infer<typeof templateMediaLineBaseSchema>;

function validateTemplateMediaRow(row: TemplateMediaLineBase, ctx: z.RefinementCtx): void {
  const hasFile = !!row.uploadedFileId?.trim();
  const hasUrl = !!row.externalUrl?.trim();
  if (row.kind === SemenTemplateMediaKind.VIDEO_URL) {
    if (!hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "VIDEO_URL requires externalUrl",
      });
    }
  } else if (row.kind === SemenTemplateMediaKind.VIDEO_UPLOAD) {
    if (!hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "VIDEO_UPLOAD requires uploadedFileId (admin upload)",
      });
    }
  } else if (
    row.kind === SemenTemplateMediaKind.COVER ||
    row.kind === SemenTemplateMediaKind.GALLERY
  ) {
    if (!hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "COVER/GALLERY requires uploadedFileId",
      });
    }
  }
}

const templateMediaLineSchema = templateMediaLineBaseSchema.superRefine(validateTemplateMediaRow);

const nonNegDecimal = z.union([
  z.number().nonnegative(),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "invalid decimal"),
]);

const semenServiceTemplateBodyBaseSchema = z
  .object({
    internalName: z.string().trim().min(1).max(200),
    animalType: z.nativeEnum(AnimalType),
    semenProviderId: z.string().trim().min(1),
    semenProductKind: z.nativeEnum(SemenProductKind),
    otherSemenLabel: optionalTrim(120),
    shortDescription: optionalTrim(8000),
    detailedDescription: optionalTrim(16000),
    expectedBenefits: optionalTrim(8000),
    recommendedAnimalCondition: optionalTrim(8000),
    warningsContraindications: optionalTrim(8000),
    defaultBasePrice: nonNegDecimal,
    defaultOfferPrice: nonNegDecimal.optional().nullable(),
    defaultDiscountPercent: z
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
    tagsJson: z.unknown().optional().nullable(),
    isActive: z.boolean().optional(),
    approvalStatus: z.nativeEnum(SemenTemplateApprovalStatus).optional(),
    rejectedReason: optionalTrim(4000),
    breedMix: z.array(breedMixLineSchema).min(1).max(20),
    media: z.array(templateMediaLineSchema).max(24).optional().default([]),
  })
  .strict();

type SemenTemplateBodyBase = z.infer<typeof semenServiceTemplateBodyBaseSchema>;

function decimalFieldMeaningfullySet(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

function validateOfferXorDiscountForCreate(
  data: Pick<SemenTemplateBodyBase, "defaultOfferPrice" | "defaultDiscountPercent">,
  ctx: z.RefinementCtx,
): void {
  const hasOffer = decimalFieldMeaningfullySet(data.defaultOfferPrice);
  const hasDisc = decimalFieldMeaningfullySet(data.defaultDiscountPercent);
  if (hasOffer && hasDisc) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot set both defaultOfferPrice and defaultDiscountPercent",
    });
  }
}

function validateOfferXorDiscountForPatch(data: Record<string, unknown>, ctx: z.RefinementCtx): void {
  const offerTouched = Object.prototype.hasOwnProperty.call(data, "defaultOfferPrice");
  const discTouched = Object.prototype.hasOwnProperty.call(data, "defaultDiscountPercent");
  if (!offerTouched && !discTouched) return;
  const hasOffer = decimalFieldMeaningfullySet(data.defaultOfferPrice);
  const hasDisc = decimalFieldMeaningfullySet(data.defaultDiscountPercent);
  if (hasOffer && hasDisc) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot set both defaultOfferPrice and defaultDiscountPercent",
    });
  }
}

function validateBreedMixPercentSum(
  breedMix: { percentage: unknown }[] | undefined,
  ctx: z.RefinementCtx,
): void {
  if (!breedMix?.length) return;
  const sum = breedMix.reduce((acc, m) => acc + Number(m.percentage), 0);
  if (Math.abs(sum - 100) > 0.02) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["breedMix"],
      message: `Breed percentages must sum to 100 (got ${sum})`,
    });
  }
}

function validateOtherSemenLabelWhenOtherCreate(
  data: Pick<SemenTemplateBodyBase, "semenProductKind" | "otherSemenLabel">,
  ctx: z.RefinementCtx,
): void {
  if (data.semenProductKind !== SemenProductKind.OTHER) return;
  const t =
    data.otherSemenLabel == null
      ? ""
      : typeof data.otherSemenLabel === "string"
        ? data.otherSemenLabel.trim()
        : "";
  if (!t) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherSemenLabel"],
      message: "Required when semenProductKind is OTHER",
    });
  }
}

function validateOtherSemenLabelWhenOtherPatch(
  data: Partial<SemenTemplateBodyBase>,
  ctx: z.RefinementCtx,
): void {
  if (data.semenProductKind !== SemenProductKind.OTHER) return;
  if (!Object.prototype.hasOwnProperty.call(data, "otherSemenLabel")) return;
  const raw = data.otherSemenLabel;
  const t = raw == null ? "" : typeof raw === "string" ? raw.trim() : "";
  if (t === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherSemenLabel"],
      message: "Required when semenProductKind is OTHER",
    });
  }
}

function validateRejectReasonWhenRejectedCreate(
  data: Pick<SemenTemplateBodyBase, "approvalStatus" | "rejectedReason">,
  ctx: z.RefinementCtx,
): void {
  if (data.approvalStatus !== SemenTemplateApprovalStatus.REJECTED) return;
  const r =
    data.rejectedReason == null
      ? ""
      : typeof data.rejectedReason === "string"
        ? data.rejectedReason.trim()
        : "";
  if (!r) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rejectedReason"],
      message: "Required when approvalStatus is REJECTED",
    });
  }
}

function validateRejectReasonWhenRejectedPatch(data: Record<string, unknown>, ctx: z.RefinementCtx): void {
  if (!Object.prototype.hasOwnProperty.call(data, "approvalStatus")) return;
  if (data.approvalStatus !== SemenTemplateApprovalStatus.REJECTED) return;
  const raw = data.rejectedReason;
  const r = raw == null ? "" : typeof raw === "string" ? raw.trim() : "";
  if (!r) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rejectedReason"],
      message: "Required when approvalStatus is REJECTED",
    });
  }
}

function validateSemenTemplateBusinessRules(data: SemenTemplateBodyBase, ctx: z.RefinementCtx): void {
  validateOfferXorDiscountForCreate(data, ctx);
  validateOtherSemenLabelWhenOtherCreate(data, ctx);
  validateBreedMixPercentSum(data.breedMix, ctx);
  validateRejectReasonWhenRejectedCreate(data, ctx);
}

function validateSemenTemplateBusinessRulesForPatch(
  data: Partial<SemenTemplateBodyBase>,
  ctx: z.RefinementCtx,
): void {
  const rec = data as Record<string, unknown>;
  validateOfferXorDiscountForPatch(rec, ctx);
  validateOtherSemenLabelWhenOtherPatch(data, ctx);
  if (Object.prototype.hasOwnProperty.call(data, "breedMix") && data.breedMix !== undefined) {
    validateBreedMixPercentSum(data.breedMix, ctx);
  }
  validateRejectReasonWhenRejectedPatch(rec, ctx);
}

export const createSemenServiceTemplateBodySchema = semenServiceTemplateBodyBaseSchema.superRefine(
  validateSemenTemplateBusinessRules,
);

export const patchSemenServiceTemplateBodySchema = semenServiceTemplateBodyBaseSchema
  .partial()
  .strict()
  .superRefine(validateSemenTemplateBusinessRulesForPatch);

export const approveSemenTemplateBodySchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    rejectedReason: optionalTrim(4000),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (b.action === "REJECT") {
      const r = b.rejectedReason?.trim();
      if (!r) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejectedReason"],
          message: "Required when rejecting",
        });
      }
    }
  });

export const listSemenTemplatesQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    animalType: z.nativeEnum(AnimalType).optional(),
    semenProviderId: z.string().trim().optional(),
    approvalStatus: z.nativeEnum(SemenTemplateApprovalStatus).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export type CreateSemenProviderBody = z.infer<typeof createSemenProviderBodySchema>;
export type PatchSemenProviderBody = z.infer<typeof patchSemenProviderBodySchema>;
export type CreateLivestockBreedBody = z.infer<typeof createLivestockBreedBodySchema>;
export type PatchLivestockBreedBody = z.infer<typeof patchLivestockBreedBodySchema>;
export type CreateSemenServiceTemplateBody = z.infer<typeof createSemenServiceTemplateBodySchema>;
export type PatchSemenServiceTemplateBody = z.infer<typeof patchSemenServiceTemplateBodySchema>;
export type ApproveSemenTemplateBody = z.infer<typeof approveSemenTemplateBodySchema>;
