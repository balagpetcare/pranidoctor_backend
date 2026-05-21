/**
 * S3 / MinIO–compatible object storage configuration (read from env).
 * See docs/UPLOAD_STORAGE_SETUP.md.
 */
export type StorageDriver = "s3" | "disabled";

export type StorageEnv = {
  driver: StorageDriver;
  endpoint: string | undefined;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  maxImageBytes: number;
  maxDocumentBytes: number;
  allowedImageMimes: Set<string>;
  allowedDocumentMimes: Set<string>;
  allowedVideoMimes: Set<string>;
};

function parseMb(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number.parseFloat(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function parseMimeList(raw: string | undefined, fallback: string): Set<string> {
  const s = (raw?.trim() || fallback)
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return new Set(s);
}

export function getStorageEnv(): StorageEnv {
  const driverRaw = (process.env.STORAGE_DRIVER ?? "s3").trim().toLowerCase();
  const driver: StorageDriver = driverRaw === "disabled" ? "disabled" : "s3";

  return {
    driver,
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    bucket: process.env.S3_BUCKET?.trim() || "pranidoctor-dev",
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || "",
    forcePathStyle:
      (process.env.S3_FORCE_PATH_STYLE ?? "true").trim().toLowerCase() === "true",
    maxImageBytes: Math.round(parseMb("UPLOAD_MAX_IMAGE_MB", 5) * 1024 * 1024),
    maxDocumentBytes: Math.round(parseMb("UPLOAD_MAX_DOCUMENT_MB", 10) * 1024 * 1024),
    allowedImageMimes: parseMimeList(
      process.env.UPLOAD_ALLOWED_IMAGE_TYPES,
      "image/jpeg,image/png,image/webp",
    ),
    allowedDocumentMimes: parseMimeList(
      process.env.UPLOAD_ALLOWED_DOCUMENT_TYPES,
      "application/pdf,image/jpeg,image/png,image/webp",
    ),
    allowedVideoMimes: parseMimeList(
      process.env.UPLOAD_ALLOWED_VIDEO_TYPES,
      "video/mp4,video/webm",
    ),
  };
}

export function isS3Configured(env: StorageEnv): boolean {
  return (
    env.driver === "s3" &&
    Boolean(env.bucket) &&
    Boolean(env.accessKeyId) &&
    Boolean(env.secretAccessKey)
  );
}
