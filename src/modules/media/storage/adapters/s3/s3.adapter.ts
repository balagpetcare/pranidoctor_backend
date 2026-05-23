import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { logDebug, logWarn } from '../../../../../shared/logger/logger.js';

import type {
  IStorageProvider,
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageConfig,
  StorageHealthResult,
} from '../../interfaces/storage-provider.interface.js';

export class S3StorageAdapter implements IStorageProvider {
  readonly name: string = 'S3StorageAdapter';
  private client: S3Client | null = null;

  constructor(private readonly config: StorageConfig) {}

  isConfigured(): boolean {
    return (
      Boolean(this.config.bucket) &&
      Boolean(this.config.accessKeyId) &&
      Boolean(this.config.secretAccessKey)
    );
  }

  protected getClient(): S3Client {
    if (!this.client) {
      const clientConfig: {
        region: string;
        forcePathStyle: boolean;
        credentials: { accessKeyId: string; secretAccessKey: string };
        endpoint?: string;
      } = {
        region: this.config.region,
        forcePathStyle: this.config.forcePathStyle,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      };

      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      this.client = new S3Client(clientConfig);
    }
    return this.client;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const client = this.getClient();

    const result = await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? 'private, max-age=0, no-store',
        Metadata: input.metadata,
      })
    );

    logDebug('Object uploaded', {
      key: input.key,
      bucket: this.config.bucket,
      size: input.body.length,
    });

    const putResult: PutObjectResult = {
      key: input.key,
      bucket: this.config.bucket,
    };
    if (result.ETag) putResult.etag = result.ETag;
    return putResult;
  }

  async deleteObject(key: string): Promise<void> {
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })
    );
    logDebug('Object deleted', { key });
  }

  async objectExists(key: string): Promise<boolean> {
    const client = this.getClient();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getSignedGetUrl(options: SignedUrlOptions): Promise<string> {
    const client = this.getClient();
    const expiresIn = options.expiresIn ?? this.config.signedUrlExpirySeconds;
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: options.key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  async getSignedPutUrl(options: SignedUrlOptions): Promise<string> {
    const client = this.getClient();
    const expiresIn = options.expiresIn ?? this.config.signedUrlExpirySeconds;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: options.key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  async checkHealth(): Promise<StorageHealthResult> {
    if (!this.isConfigured()) {
      return { healthy: false, error: 'Storage not configured' };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      await client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionRefused =
        message.includes('ECONNREFUSED') || message.includes('ENOTFOUND');
      if (isConnectionRefused) {
        logWarn('Storage endpoint unreachable', { error: message });
      } else {
        logWarn('Storage health check failed', { error: message });
      }
      return {
        healthy: false,
        latency: Date.now() - start,
        error: message,
      };
    }
  }
}
