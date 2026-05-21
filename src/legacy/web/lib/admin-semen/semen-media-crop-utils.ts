import type { Area } from "react-easy-crop";

import { cropImageToBlob, type CropImageOptions } from "@/components/admin/media/cropImage";

export type CroppedImageBlobOptions = CropImageOptions;

/**
 * Backwards-compatible wrapper for the admin crop pipeline.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  mimeTypeOrOptions: string | CroppedImageBlobOptions = "image/jpeg",
  legacyQuality = 0.92,
): Promise<Blob> {
  const opts: CroppedImageBlobOptions =
    typeof mimeTypeOrOptions === "string"
      ? { mimeType: mimeTypeOrOptions, quality: legacyQuality }
      : mimeTypeOrOptions;

  return cropImageToBlob(imageSrc, pixelCrop, opts);
}
