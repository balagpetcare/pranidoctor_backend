import { z } from "zod";

import {
  AiTechnicianDocumentType,
  Gender,
} from "@/generated/prisma/client";

const optionalTrim = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable();

export const applyAiTechnicianBodySchema = z
  .object({
    displayName: optionalTrim(120),
    phone: optionalTrim(32),
    email: z.string().trim().email().max(200).optional().nullable(),
    nidNumber: optionalTrim(64),
    dateOfBirth: z.string().trim().max(40).optional().nullable(),
    gender: z.nativeEnum(Gender).optional().nullable(),
    presentAddress: optionalTrim(4000),
    district: optionalTrim(200),
    upazila: optionalTrim(200),
    unionOrArea: optionalTrim(200),
    /// Optional FKs to `District` / `Upazila` / `Union` — when set, server fills Bengali-first `district` / `upazila` / `unionOrArea` text.
    districtId: z.string().cuid().optional().nullable(),
    upazilaId: z.string().cuid().optional().nullable(),
    unionId: z.string().cuid().optional().nullable(),
    experienceYears: z.coerce.number().int().min(0).max(80).optional().nullable(),
    trainingProvider: optionalTrim(300),
    certificateNumber: optionalTrim(120),
    certification: optionalTrim(500),
    bio: optionalTrim(4000),
    acceptsEmergency: z.boolean().optional(),
    serviceFeeBdt: z.union([z.number().nonnegative(), z.string().trim()]).optional().nullable(),
    metadataJson: z.unknown().optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasAnyId = Boolean(data.districtId) || Boolean(data.upazilaId) || Boolean(data.unionId);
    if (!hasAnyId) return;
    if (!data.districtId || !data.upazilaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "জেলা ও উপজেলা আইডি একসাথে দিতে হবে",
        path: ["districtId"],
      });
    }
    if (data.unionId && (!data.districtId || !data.upazilaId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ইউনিয়ন আইডির জন্য জেলা ও উপজেলা আইডি প্রয়োজন",
        path: ["unionId"],
      });
    }
  });

export type ApplyAiTechnicianBody = z.infer<typeof applyAiTechnicianBodySchema>;

export const createAiTechnicianDocumentBodySchema = z
  .object({
    type: z.nativeEnum(AiTechnicianDocumentType),
    title: z.string().trim().min(1).max(200),
    uploadedFileId: z.string().cuid().optional().nullable(),
    fileUrl: z.string().trim().url().max(2000).optional().nullable(),
    storageKey: z.string().trim().min(1).max(500).optional().nullable(),
    mimeType: optionalTrim(120),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasUpload = Boolean(data.uploadedFileId?.trim());
    const hasLegacy =
      Boolean(data.fileUrl?.trim()) || Boolean(data.storageKey?.trim());
    if (!hasUpload && !hasLegacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "uploadedFileId অথবা fileUrl/storageKey এর মধ্যে একটি পথ দিন",
        path: ["uploadedFileId"],
      });
    }
    if (hasUpload && hasLegacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "uploadedFileId এবং ম্যানুয়াল URL একসাথে দেওয়া যাবে না",
        path: ["uploadedFileId"],
      });
    }
  });

export type CreateAiTechnicianDocumentBody = z.infer<
  typeof createAiTechnicianDocumentBodySchema
>;

export const createDivisionServiceAreaBodySchema = z
  .object({
    district: optionalTrim(200),
    upazila: optionalTrim(200),
    unionOrArea: optionalTrim(200),
    districtId: z.string().cuid().optional().nullable(),
    upazilaId: z.string().cuid().optional().nullable(),
    unionId: z.string().cuid().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasIds = Boolean(data.districtId) && Boolean(data.upazilaId);
    const dt = data.district?.trim() ?? "";
    const ut = data.upazila?.trim() ?? "";
    const hasText = dt.length >= 1 && ut.length >= 1;
    if (!hasIds && !hasText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "জেলা ও উপজেলা দিন অথবা সঠিক লোকেশন আইডি দিন",
        path: ["districtId"],
      });
    }
    if (data.unionId && !hasIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ইউনিয়ন আইডির জন্য জেলা ও উপজেলা আইডি প্রয়োজন",
        path: ["unionId"],
      });
    }
  });

export type CreateDivisionServiceAreaBody = z.infer<
  typeof createDivisionServiceAreaBodySchema
>;
