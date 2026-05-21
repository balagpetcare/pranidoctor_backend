import { z } from "zod";

/** At least one clinical text field must be non-empty. */
export const createDoctorTreatmentBodySchema = z
  .object({
    chiefComplaint: z.string().max(8000).optional(),
    symptoms: z.string().max(8000).optional(),
    diagnosis: z.string().max(8000).optional(),
    procedures: z.string().max(8000).optional(),
    treatmentNotes: z.string().max(8000).optional(),
    followUpNotes: z.string().max(8000).optional(),
    followUpDate: z
      .string()
      .max(32)
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),
  })
  .strict()
  .superRefine((data, ctx) => {
    const fields = [
      data.chiefComplaint,
      data.symptoms,
      data.diagnosis,
      data.procedures,
      data.treatmentNotes,
      data.followUpNotes,
    ];
    const any = fields.some((f) => f?.trim());
    if (!any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one of diagnosis, symptoms, treatment notes, or related fields",
        path: ["diagnosis"],
      });
    }
  });

export type CreateDoctorTreatmentBody = z.infer<
  typeof createDoctorTreatmentBodySchema
>;

const prescriptionItemSchema = z
  .object({
    medicineName: z.string().trim().min(1).max(500),
    dosage: z.string().max(500).optional(),
    frequency: z.string().max(300).optional(),
    duration: z.string().max(500).optional(),
    instruction: z.string().max(2000).optional(),
    note: z.string().max(2000).optional(),
    quantity: z.string().max(50).optional(),
  })
  .strict();

export const createDoctorPrescriptionBodySchema = z
  .object({
    instructions: z.string().max(8000).optional(),
    validUntil: z
      .string()
      .max(32)
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),
    items: z.array(prescriptionItemSchema).min(1).max(50),
  })
  .strict();

export type CreateDoctorPrescriptionBody = z.infer<
  typeof createDoctorPrescriptionBodySchema
>;
