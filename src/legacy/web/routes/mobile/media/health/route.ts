import { jsonOk } from '@/lib/api-response';
import { deleteObjectBytes, putObjectBytes } from '@/lib/storage/s3-client';
import { getStorageEnv, isS3Configured } from '@/lib/storage/storage-env';

/** GET storage probe for mobile media uploads (MinIO/S3). */
export async function GET(_request: Request): Promise<Response> {
  const env = getStorageEnv();
  const configured = isS3Configured(env);

  if (env.driver === 'disabled' || !configured) {
    return jsonOk({
      storage: env.driver,
      bucket: env.bucket,
      write: false,
      read: false,
      ok: false,
      reason: env.driver === 'disabled' ? 'STORAGE_DISABLED' : 'STORAGE_NOT_CONFIGURED',
    });
  }

  const probeKey = `health/_probe_${Date.now()}.txt`;
  const body = Buffer.from('pranidoctor-media-health-probe', 'utf8');
  let write = false;
  let read = false;

  try {
    await putObjectBytes({
      env,
      key: probeKey,
      body,
      contentType: 'text/plain',
    });
    write = true;
    read = true;
    await deleteObjectBytes({ env, key: probeKey });
  } catch (error) {
    console.info(
      '[MEDIA_HEALTH]',
      JSON.stringify({
        ok: false,
        bucket: env.bucket,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  return jsonOk({
    storage: env.driver,
    bucket: env.bucket,
    write,
    read,
    ok: write && read,
  });
}
