import { mkdir, readFile, unlink, writeFile, access, constants } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { logDebug } from '../../../../../shared/logger/logger.js';

import type {
  IStorageProvider,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageConfig,
  StorageHealthResult,
} from '../../interfaces/storage-provider.interface.js';

export class LocalStorageAdapter implements IStorageProvider {
  readonly name = 'LocalStorageAdapter';

  constructor(private readonly config: StorageConfig) {}

  private resolvePath(key: string): string {
    const base = resolve(this.config.localPath);
    return join(base, key);
  }

  isConfigured(): boolean {
    return Boolean(this.config.localPath);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const filePath = this.resolvePath(input.key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);

    logDebug('Local object written', { key: input.key, path: filePath });

    return {
      key: input.key,
      bucket: 'local',
    };
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await unlink(filePath);
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await access(this.resolvePath(key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedGetUrl(options: SignedUrlOptions): Promise<string> {
    const filePath = this.resolvePath(options.key);
    await access(filePath, constants.F_OK);
    return `file://${filePath}`;
  }

  async getSignedPutUrl(options: SignedUrlOptions): Promise<string> {
    return `file://${this.resolvePath(options.key)}`;
  }

  async checkHealth(): Promise<StorageHealthResult> {
    const start = Date.now();
    try {
      const probe = this.resolvePath('__health_check__');
      await mkdir(dirname(probe), { recursive: true });
      await writeFile(probe, Buffer.from('ok'));
      await readFile(probe);
      await unlink(probe).catch(() => undefined);
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Local storage unavailable',
      };
    }
  }
}
