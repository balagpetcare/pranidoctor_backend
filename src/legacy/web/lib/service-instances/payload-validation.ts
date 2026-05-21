import "server-only";

import { Prisma } from "@/generated/prisma/client";

export type PayloadValidationIssue = {
  path: string;
  messageBn: string;
};

export function validateServiceInstancePayloadJson(
  payload: unknown,
): { ok: true } | { ok: false; issues: PayloadValidationIssue[] } {
  const issues: PayloadValidationIssue[] = [];
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    issues.push({ path: "$", messageBn: "পেলোড অবশ্যই অবজেক্ট হতে হবে" });
    return { ok: false, issues };
  }
  const o = payload as Record<string, unknown>;

  const hasOffer =
    o.offerPrice != null &&
    String(o.offerPrice).trim() !== "" &&
    String(o.offerPrice).trim() !== "null";
  const hasDisc =
    o.discountPercent != null &&
    String(o.discountPercent).trim() !== "" &&
    String(o.discountPercent).trim() !== "null";
  if (hasOffer && hasDisc) {
    issues.push({
      path: "offerPrice",
      messageBn: "অফার মূল্য এবং ছাড় % একসাথে দেওয়া যাবে না",
    });
  }

  const decFields = ["basePrice", "offerPrice", "discountPercent", "visitFee", "emergencyFee"];
  for (const f of decFields) {
    const v = o[f];
    if (v == null || v === "") continue;
    try {
      const d = new Prisma.Decimal(String(v));
      if (d.lessThan(0)) {
        issues.push({ path: f, messageBn: "ঋণাত্মক মান গ্রহণযোগ্য নয়" });
      }
      if (f === "discountPercent" && d.greaterThan(100)) {
        issues.push({ path: f, messageBn: "ছাড় ১০০% এর বেশি হতে পারে না" });
      }
    } catch {
      issues.push({ path: f, messageBn: "সংখ্যা বিন্যাস সঠিক নয়" });
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}
