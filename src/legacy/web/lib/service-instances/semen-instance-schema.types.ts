/**
 * Pure schema types for the Prani semen service-instance form renderer.
 * Safe to import from Client Components — no Prisma / Node runtime.
 */

export const PRANI_SCHEMA_VERSION = 1 as const;

export type PraniSchemaFieldType =
  | "text"
  | "textarea"
  | "pricing"
  | "tags"
  | "note"
  | "warning"
  | "section"
  | "accordion"
  | "media"
  | "table"
  | "animalCondition"
  | "dosage"
  | "richText";

export type PraniSchemaField = {
  key: string;
  type: PraniSchemaFieldType;
  labelBn: string;
  labelEn?: string;
  readOnly?: boolean;
  /** When readOnly — value resolved from template serialization, not payload. */
  source?: "template" | "payload";
  templateKey?: string;
  widget?: string;
  helpBn?: string;
};

export type PraniSchemaSection = {
  id: string;
  titleBn: string;
  titleEn?: string;
  fields: PraniSchemaField[];
};

export type PraniSchemaDocument = {
  version: typeof PRANI_SCHEMA_VERSION;
  sections: PraniSchemaSection[];
};
