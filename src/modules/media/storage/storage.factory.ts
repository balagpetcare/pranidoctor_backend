import type { AppConfig } from '../../../shared/config/config.schema.js';
import { logWarn } from '../../../shared/logger/logger.js';

import { DisabledStorageAdapter } from './adapters/disabled/disabled.adapter.js';
import { LocalStorageAdapter } from './adapters/local/local.adapter.js';
import { MinioStorageAdapter } from './adapters/minio/minio.adapter.js';
import { S3StorageAdapter } from './adapters/s3/s3.adapter.js';
import type { IStorageProvider, StorageConfig } from './interfaces/storage-provider.interface.js';

let storageInstance: IStorageProvider | null = null;
let runtimeDegraded = false;
let runtimeDegradeReason: string | undefined;

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
  if (!config.storage.enabled) return false;
  if (config.storage.driver === 'disabled') return false;
  if (config.storage.driver === 'local') return true;
  return Boolean(config.storage.accessKeyId && config.storage.secretAccessKey);
}

export function isStorageOperational(config: AppConfig): boolean {
  return isStorageEnabled(config) && !runtimeDegraded;
}

export function isStorageRuntimeDegraded(): boolean {
  return runtimeDegraded;
}

export function getStorageRuntimeDegradeReason(): string | undefined {
  return runtimeDegradeReason;
}

/**
 * Swap to a disabled adapter when remote storage is unreachable in development.
 * Upload routes should treat this the same as STORAGE_ENABLED=false.
 */
export function degradeStorageRuntime(reason: string): void {
  if (runtimeDegraded) return;

  runtimeDegraded = true;
  runtimeDegradeReason = reason;
  storageInstance = new DisabledStorageAdapter();
  process.env['STORAGE_RUNTIME_DEGRADED'] = 'true';

  logWarn('Storage degraded at runtime — uploads disabled until storage is reachable', {
    reason,
  });
}

export function resetStorage(): void {
  storageInstance = null;
  runtimeDegraded = false;
  runtimeDegradeReason = undefined;
  delete process.env['STORAGE_RUNTIME_DEGRADED'];
}
