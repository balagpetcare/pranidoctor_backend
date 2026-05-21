import { describe, expect, it } from "vitest";

import { AiTechnicianDocumentType } from "@/generated/prisma/client";

import {
  createAiTechnicianDocumentBodySchema,
  createDivisionServiceAreaBodySchema,
} from "./schemas";
describe("createAiTechnicianDocumentBodySchema", () => {
  const validCuid = "ckobwmfqy0000z1q9jfqj8h3f";

  it("accepts fileUrl without storageKey", () => {
    const r = createAiTechnicianDocumentBodySchema.safeParse({
      type: AiTechnicianDocumentType.NID_FRONT,
      title: "সামনে",
      fileUrl: "https://example.com/a.jpg",
    });
    expect(r.success).toBe(true);
  });

  it("accepts uploadedFileId without legacy urls", () => {
    const r = createAiTechnicianDocumentBodySchema.safeParse({
      type: AiTechnicianDocumentType.NID_BACK,
      title: "পিছন",
      uploadedFileId: validCuid,
    });
    expect(r.success).toBe(true);
  });

  it("rejects when uploadedFileId and fileUrl are both provided", () => {
    const r = createAiTechnicianDocumentBodySchema.safeParse({
      type: AiTechnicianDocumentType.NID_FRONT,
      title: "সামনে",
      uploadedFileId: validCuid,
      fileUrl: "https://example.com/a.jpg",
    });
    expect(r.success).toBe(false);
  });

  it("rejects when uploadedFileId, fileUrl, and storageKey are all missing", () => {
    const r = createAiTechnicianDocumentBodySchema.safeParse({
      type: AiTechnicianDocumentType.NID_BACK,
      title: "পিছন",
    });
    expect(r.success).toBe(false);
  });
});

describe("createDivisionServiceAreaBodySchema", () => {
  it("rejects when neither text nor ids provided", () => {
    expect(createDivisionServiceAreaBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts legacy district + upazila text", () => {
    const r = createDivisionServiceAreaBodySchema.safeParse({
      district: "Dhaka",
      upazila: "Savar",
    });
    expect(r.success).toBe(true);
  });

  it("rejects unionId without districtId + upazilaId", () => {
    const r = createDivisionServiceAreaBodySchema.safeParse({
      district: "Dhaka",
      upazila: "Savar",
      unionId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(r.success).toBe(false);
  });
});
