import type { StorageConfig } from '../../interfaces/storage-provider.interface.js';
import { S3StorageAdapter } from '../s3/s3.adapter.js';

/**
 * MinIO uses the S3 API. This adapter enforces path-style URLs (required for MinIO).
 */
export class MinioStorageAdapter extends S3StorageAdapter {
  constructor(config: StorageConfig) {
    super({
      ...config,
      forcePathStyle: true,
    });
  }
}
