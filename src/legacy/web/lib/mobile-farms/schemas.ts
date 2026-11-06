import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,59}$/, "invalid code");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const farmIdSchema = z
  .string()
  .trim()
  .min(6)
  .max(200)
  .regex(/^farm-[A-Za-z0-9_:.-]+$/, "id must start with farm-");

const addressFields = {
  divisionId: optionalText(100),
  districtId: optionalText(100),
  upazilaId: optionalText(100),
  unionId: optionalText(100),
  villageId: optionalText(100),
  villageName: optionalText(200),
  line1: optionalText(500),
  locationLabel: optionalText(500),
};

/** Type/sub type codes are checked against the admin catalog in the service. */
export const createFarmBodySchema = z
  .object({
    /** Optional client id so a pre-existing profile-derived farm keeps its id. */
    id: farmIdSchema.optional(),
    name: z.string().trim().min(2).max(160),
    type: codeSchema,
    subType: codeSchema.optional(),
    coverPhotoUrl: z.string().trim().url().max(2000).optional(),
    ...addressFields,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.unionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unionId is required",
        path: ["unionId"],
      });
    }
  });

export const updateFarmBodySchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    type: codeSchema.optional(),
    subType: codeSchema.nullable().optional(),
    coverPhotoUrl: z.string().trim().url().max(2000).nullable().optional(),
    ...addressFields,
  })
  .strict();

export type CreateFarmBody = z.infer<typeof createFarmBodySchema>;
export type UpdateFarmBody = z.infer<typeof updateFarmBodySchema>;

export const farmTypeCodeSchema = codeSchema;

const labelSchema = z.string().trim().min(1).max(120);
const hintSchema = z
  .string()
  .trim()
  .max(240)
  .nullable()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const createFarmTypeConfigBodySchema = z
  .object({
    code: codeSchema,
    parentCode: codeSchema.nullable().optional(),
    labelBn: labelSchema,
    labelEn: labelSchema,
    hintBn: hintSchema,
    hintEn: hintSchema,
    unit: z.enum(["ANIMAL", "FLOCK"]).default("ANIMAL"),
    sortOrder: z.coerce.number().int().min(0).max(100000).default(100),
    isActive: z.boolean().default(true),
  })
  .strict();

/** `code` and `parentCode` are immutable: farms reference them. */
export const patchFarmTypeConfigBodySchema = z
  .object({
    labelBn: labelSchema.optional(),
    labelEn: labelSchema.optional(),
    hintBn: hintSchema,
    hintEn: hintSchema,
    unit: z.enum(["ANIMAL", "FLOCK"]).optional(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateFarmTypeConfigBody = z.infer<typeof createFarmTypeConfigBodySchema>;
export type PatchFarmTypeConfigBody = z.infer<typeof patchFarmTypeConfigBodySchema>;
