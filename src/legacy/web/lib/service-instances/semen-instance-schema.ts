import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { PRANI_SCHEMA_VERSION, type PraniSchemaDocument } from "./semen-instance-schema.types";

export type {
  PraniSchemaDocument,
  PraniSchemaField,
  PraniSchemaFieldType,
  PraniSchemaSection,
} from "./semen-instance-schema.types";
export { PRANI_SCHEMA_VERSION } from "./semen-instance-schema.types";

type TemplateRow = Prisma.SemenServiceTemplateGetPayload<{
  include: {
    semenProvider: true;
    breedMixes: { include: { breed: true } };
  };
}>;

export function buildSemenServiceInstanceSchema(
  template: TemplateRow,
): PraniSchemaDocument {
  void template.id;
  return {
    version: PRANI_SCHEMA_VERSION,
    sections: [
      {
        id: "template-locked",
        titleBn: "টেমপ্লেট তথ্য (লক)",
        titleEn: "Template (read-only)",
        fields: [
          {
            key: "tpl.internalName",
            type: "text",
            labelBn: "পণ্যের নাম",
            readOnly: true,
            source: "template",
            templateKey: "internalName",
          },
          {
            key: "tpl.animalType",
            type: "text",
            labelBn: "প্রাণীর ধরন",
            readOnly: true,
            source: "template",
            templateKey: "animalType",
          },
          {
            key: "tpl.semenProvider",
            type: "text",
            labelBn: "প্রদানকারী",
            readOnly: true,
            source: "template",
            templateKey: "semenProvider",
          },
          {
            key: "tpl.breedComposition",
            type: "animalCondition",
            labelBn: "জাত মিশ্রণ",
            readOnly: true,
            source: "template",
            templateKey: "breedComposition",
          },
          {
            key: "tpl.warningsContraindications",
            type: "warning",
            labelBn: "সতর্কতা",
            readOnly: true,
            source: "template",
            templateKey: "warningsContraindications",
          },
          {
            key: "tpl.expectedBenefits",
            type: "textarea",
            labelBn: "প্রত্যাশিত উপকার",
            readOnly: true,
            source: "template",
            templateKey: "expectedBenefits",
          },
          {
            key: "tpl.recommendedAnimalCondition",
            type: "animalCondition",
            labelBn: "প্রাণীর অবস্থা সুপারিশ",
            readOnly: true,
            source: "template",
            templateKey: "recommendedAnimalCondition",
          },
          {
            key: "tpl.detailedDescription",
            type: "richText",
            labelBn: "বিস্তারিত",
            readOnly: true,
            source: "template",
            templateKey: "detailedDescription",
          },
          {
            key: "tpl.tagsJson",
            type: "tags",
            labelBn: "ট্যাগ",
            readOnly: true,
            source: "template",
            templateKey: "tagsJson",
          },
        ],
      },
      {
        id: "worker-overrides",
        titleBn: "কারিগর ওভাররাইড",
        titleEn: "Technician overrides",
        fields: [
          {
            key: "basePrice",
            type: "pricing",
            labelBn: "মূল মূল্য (৳)",
            source: "payload",
          },
          {
            key: "offerPrice",
            type: "pricing",
            labelBn: "অফার মূল্য (৳)",
            source: "payload",
          },
          {
            key: "discountPercent",
            type: "pricing",
            labelBn: "ছাড় %",
            source: "payload",
          },
          {
            key: "visitFee",
            type: "pricing",
            labelBn: "ভিজিট ফি (৳)",
            source: "payload",
          },
          {
            key: "emergencyFee",
            type: "pricing",
            labelBn: "জরুরি ফি (৳)",
            source: "payload",
          },
          {
            key: "technicianServiceNote",
            type: "textarea",
            labelBn: "ব্যক্তিগত নোট",
            source: "payload",
          },
          {
            key: "isAvailable",
            type: "text",
            labelBn: "লিস্টিং সক্রিয়",
            source: "payload",
          },
        ],
      },
    ],
  };
}

export function mergeTemplateAndPayloadValues(
  template: TemplateRow,
  payloadJson: unknown,
): Record<string, unknown> {
  const breedLabel = template.breedMixes
    .map((m) => `${m.percentage.toString()}% ${m.breed.nameEn}`)
    .join(" + ");
  const tpl = {
    internalName: template.internalName,
    animalType: template.animalType,
    semenProvider: template.semenProvider.name,
    semenProductKind: template.semenProductKind,
    otherSemenLabel: template.otherSemenLabel,
    breedComposition: breedLabel,
    shortDescription: template.shortDescription,
    detailedDescription: template.detailedDescription,
    expectedBenefits: template.expectedBenefits,
    recommendedAnimalCondition: template.recommendedAnimalCondition,
    warningsContraindications: template.warningsContraindications,
    defaultBasePrice: template.defaultBasePrice.toString(),
    defaultOfferPrice: template.defaultOfferPrice?.toString() ?? null,
    defaultDiscountPercent: template.defaultDiscountPercent?.toString() ?? null,
    tagsJson: template.tagsJson,
  };

  const p =
    payloadJson && typeof payloadJson === "object" && !Array.isArray(payloadJson)
      ? (payloadJson as Record<string, unknown>)
      : {};

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(tpl)) {
    out[`tpl.${k}`] = v;
  }
  for (const [k, v] of Object.entries(p)) {
    out[k] = v;
  }
  return out;
}
