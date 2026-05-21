import type { AppConfig } from '../../../shared/config/config.schema.js';

import { DisabledStorageAdapter } from './adapters/disabled/disabled.adapter.js';
import { LocalStorageAdapter } from './adapters/local/local.adapter.js';
import { MinioStorageAdapter } from './adapters/minio/minio.adapter.js';
import { S3StorageAdapter } from './adapters/s3/s3.adapter.js';
import type { IStorageProvider, StorageConfig } from './interfaces/storage-provider.interface.js';

let storageInstance: IStorageProvider | null = null;

export function buildStorageConfig(config: AppConfig): StorageConfig {
  return config.storage;
}

export function createStorageProvider(config: AppConfig): IStorageProvider {
  const storageConfig = buildStorageConfig(config);

  switch (storageConfig.driver) {
    case 's3':
      return new S3StorageAdapter(storageConfig);
    case 'minio':
      return new MinioStorageAdapter(storageConfig);
    case 'local':
      return new LocalStorageAdapter(storageConfig);
    case 'disabled':
    default:
      return new DisabledStorageAdapter();
  }
}

export function initializeStorage(config: AppConfig): IStorageProvider {
  if (storageInstance) {
    return storageInstance;
  }
  storageInstance = createStorageProvider(config);
  return storageInstance;
}

export function getStorage(): IStorageProvider {
  if (!storageInstance) {
    throw new Error('Storage not initialized. Call initializeStorage first.');
  }
  return storageInstance;
}

export function isStorageEnabled(config: AppConfig): boolean {
  if (config.storage.driver === 'disabled') return false;
  if (config.storage.driver === 'local') return true;
  return Boolean(config.storage.accessKeyId && config.storage.secretAccessKey);
}

export function resetStorage(): void {
  storageInstance = null;
}
