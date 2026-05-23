import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

import { getS3Client } from './s3-client.js';
import type { StorageEnv } from './storage-env.js';
import { isS3Configured } from './storage-env.js';

export type MinioBootstrapResult = {
  ok: boolean;
  bucketCreated: boolean;
  error?: string;
};

function bucketMissing(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name)
      : '';
  return (
    name === 'NotFound' ||
    name === 'NoSuchBucket' ||
    msg.includes('NotFound') ||
    msg.includes('NoSuchBucket') ||
    msg.includes('404')
  );
}

/** Connect to MinIO/S3 and ensure the configured bucket exists. */
export async function bootstrapMinioStorage(env: StorageEnv): Promise<MinioBootstrapResult> {
  if (env.driver === 'disabled' || !isS3Configured(env)) {
    return { ok: false, bucketCreated: false, error: 'STORAGE_NOT_CONFIGURED' };
  }

  const client = getS3Client(env);

  try {
    await client.send(new HeadBucketCommand({ Bucket: env.bucket }));
    console.info(
      '[MINIO_CONNECTED]',
      JSON.stringify({ endpoint: env.endpoint, bucket: env.bucket }),
    );
    return { ok: true, bucketCreated: false };
  } catch (headError) {
    if (!bucketMissing(headError)) {
      const message = headError instanceof Error ? headError.message : String(headError);
      return { ok: false, bucketCreated: false, error: message };
    }
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: env.bucket }));
    console.info('[BUCKET_CREATED]', JSON.stringify({ bucket: env.bucket }));
    console.info(
      '[MINIO_CONNECTED]',
      JSON.stringify({ endpoint: env.endpoint, bucket: env.bucket }),
    );
    return { ok: true, bucketCreated: true };
  } catch (createError) {
    const message = createError instanceof Error ? createError.message : String(createError);
    return { ok: false, bucketCreated: false, error: message };
  }
}
