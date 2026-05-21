import "server-only";

import type { ServiceInstanceMediaKind } from "@/generated/prisma/client";

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const PDF_MIMES = new Set(["application/pdf"]);

export function assertMimeAllowedForInstanceMediaKind(
  kind: ServiceInstanceMediaKind,
  mimeType: string,
): { ok: true } | { ok: false; message: string } {
  const m = mimeType.toLowerCase();
  switch (kind) {
    case "COVER":
    case "GALLERY":
      if (!IMAGE_MIMES.has(m)) {
        return { ok: false, message: "শুধুমাত্র ছবির ধরন গ্রহণযোগ্য" };
      }
      return { ok: true };
    case "VIDEO_UPLOAD":
      if (!VIDEO_MIMES.has(m)) {
        return { ok: false, message: "ভিডিও ধরন গ্রহণযোগ্য নয়" };
      }
      return { ok: true };
    case "DOCUMENT":
      if (!PDF_MIMES.has(m)) {
        return { ok: false, message: "শুধুমাত্র PDF" };
      }
      return { ok: true };
    case "VIDEO_URL":
      return { ok: true };
    default:
      return { ok: false, message: "অজানা মিডিয়া ধরন" };
  }
}
