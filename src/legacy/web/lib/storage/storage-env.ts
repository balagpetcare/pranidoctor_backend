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
  signedUrlExpirySeconds: number;
  publicUrl: string | undefined;
  maxImageBytes: number;
  maxDocumentBytes: number;
  maxVideoBytes: number;
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
  const runtimeDegraded =
    (process.env.STORAGE_RUNTIME_DEGRADED ?? '').trim().toLowerCase() === 'true';
  const storageEnabled =
    (process.env.STORAGE_ENABLED ?? 'true').trim().toLowerCase() !== 'false' &&
    (process.env.STORAGE_ENABLED ?? 'true').trim() !== '0' &&
    (process.env.MINIO_ENABLED ?? 'true').trim().toLowerCase() !== 'false' &&
    (process.env.MINIO_ENABLED ?? 'true').trim() !== '0';
  const driverRaw = (
    process.env.MEDIA_STORAGE ??
    process.env.STORAGE_DRIVER ??
    's3'
  )
    .trim()
    .toLowerCase();
  const driver: StorageDriver =
    !storageEnabled || runtimeDegraded || driverRaw === 'disabled' ? 'disabled' : 's3';

  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID?.trim() ||
    process.env.S3_ACCESS_KEY?.trim() ||
    process.env.MINIO_ACCESS_KEY?.trim() ||
    "";
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY?.trim() ||
    process.env.S3_SECRET_KEY?.trim() ||
    process.env.MINIO_SECRET_KEY?.trim() ||
    "";

  const signedRaw = process.env.S3_SIGNED_URL_EXPIRY_SECONDS?.trim();
  const signedParsed = signedRaw ? Number.parseInt(signedRaw, 10) : NaN;
  const signedUrlExpirySeconds =
    Number.isFinite(signedParsed) && signedParsed > 0 ? signedParsed : 300;

  return {
    driver,
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    bucket: process.env.S3_BUCKET?.trim() || process.env.MINIO_BUCKET?.trim() || "pranidoctor-dev",
    accessKeyId,
    secretAccessKey,
    forcePathStyle:
      (process.env.S3_FORCE_PATH_STYLE ?? "true").trim().toLowerCase() === "true",
    signedUrlExpirySeconds,
    publicUrl:
      process.env.MINIO_PUBLIC_URL?.trim() ||
      process.env.S3_PUBLIC_URL?.trim() ||
      undefined,
    maxImageBytes: Math.round(parseMb("UPLOAD_MAX_IMAGE_MB", 5) * 1024 * 1024),
    maxDocumentBytes: Math.round(parseMb("UPLOAD_MAX_DOCUMENT_MB", 10) * 1024 * 1024),
    maxVideoBytes: Math.round(parseMb("UPLOAD_MAX_VIDEO_MB", 80) * 1024 * 1024),
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
