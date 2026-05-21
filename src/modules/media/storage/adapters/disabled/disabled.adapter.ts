import type {
  IStorageProvider,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageHealthResult,
} from '../../interfaces/storage-provider.interface.js';

export class DisabledStorageAdapter implements IStorageProvider {
  readonly name = 'DisabledStorageAdapter';

  isConfigured(): boolean {
    return false;
  }

  async putObject(_input: PutObjectInput): Promise<PutObjectResult> {
    throw new Error('Storage is disabled (STORAGE_DRIVER=disabled)');
  }

  async deleteObject(_key: string): Promise<void> {
    throw new Error('Storage is disabled (STORAGE_DRIVER=disabled)');
  }

  async objectExists(_key: string): Promise<boolean> {
    return false;
  }

  async getSignedGetUrl(_options: SignedUrlOptions): Promise<string> {
    throw new Error('Storage is disabled (STORAGE_DRIVER=disabled)');
  }

  async getSignedPutUrl(_options: SignedUrlOptions): Promise<string> {
    throw new Error('Storage is disabled (STORAGE_DRIVER=disabled)');
  }

  async checkHealth(): Promise<StorageHealthResult> {
    return {
      healthy: true,
      error: 'Storage disabled by configuration',
    };
  }
}
