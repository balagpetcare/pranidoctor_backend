import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { StorageEnv } from "./storage-env";

let cached: S3Client | null = null;

export function getS3Client(env: StorageEnv): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: env.region,
    endpoint: env.endpoint,
    forcePathStyle: env.forcePathStyle,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  return cached;
}

export async function putObjectBytes(params: {
  env: StorageEnv;
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<void> {
  const client = getS3Client(params.env);
  await client.send(
    new PutObjectCommand({
      Bucket: params.env.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl ?? "private, max-age=0, no-store",
    }),
  );
}

export async function getSignedGetObjectUrl(params: {
  env: StorageEnv;
  key: string;
  /** seconds */
  expiresIn?: number;
}): Promise<string> {
  const client = getS3Client(params.env);
  const cmd = new GetObjectCommand({
    Bucket: params.env.bucket,
    Key: params.key,
  });
  return getSignedUrl(client, cmd, { expiresIn: params.expiresIn ?? 300 });
}
