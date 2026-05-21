import { ContentApprovalStatus } from "@/generated/prisma/client";
import { z } from "zod";

export const tutorialSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers, and hyphens",
  );

export const createTutorialBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  slug: tutorialSlugSchema,
  summary: z.string().trim().max(2000).optional().nullable(),
  body: z.string().min(1),
  coverImageUrl: z.string().trim().url().max(2000).optional().nullable(),
  categoryId: z.string().trim().min(1),
});

export const updateTutorialBodySchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    slug: tutorialSlugSchema.optional(),
    summary: z.string().trim().max(2000).optional().nullable(),
    body: z.string().min(1).optional(),
    coverImageUrl: z.string().trim().url().max(2000).optional().nullable(),
    categoryId: z.string().trim().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  });

export const rejectTutorialBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

const paginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(50).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

export const publicListTutorialsQuerySchema = paginationSchema
  .extend({
    categoryId: z.string().trim().min(1).optional(),
    categorySlug: tutorialSlugSchema.optional(),
  })
  .refine((q) => !(q.categoryId && q.categorySlug), {
    message: "Specify only one of categoryId or categorySlug",
  });

export const adminListTutorialsQuerySchema = paginationSchema.extend({
  categoryId: z.string().trim().min(1).optional(),
  approvalStatus: z.nativeEnum(ContentApprovalStatus).optional(),
  authorId: z.string().trim().min(1).optional(),
});

/** Doctor panel: list only own posts. */
export const doctorListTutorialsQuerySchema = paginationSchema.extend({
  categoryId: z.string().trim().min(1).optional(),
  approvalStatus: z.nativeEnum(ContentApprovalStatus).optional(),
});

export function parseSearchParams<T>(
  schema: z.ZodType<T>,
  params: URLSearchParams,
) {
  const raw: Record<string, string> = {};
  params.forEach((v, k) => {
    raw[k] = v;
  });
  return schema.safeParse(raw);
}

export function isLikelyCuid(value: string): boolean {
  return value.length >= 20 && value.length <= 32 && /^c[a-z0-9]+$/i.test(value);
}

export const createContentCategoryBodySchema = z.object({
  nameBn: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).optional().nullable(),
  slug: tutorialSlugSchema,
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional().default(0),
  isActive: z.boolean().default(true),
});

export const updateContentCategoryBodySchema = z
  .object({
    nameBn: z.string().trim().min(1).max(200).optional(),
    nameEn: z.string().trim().max(200).optional().nullable(),
    slug: tutorialSlugSchema.optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  });
