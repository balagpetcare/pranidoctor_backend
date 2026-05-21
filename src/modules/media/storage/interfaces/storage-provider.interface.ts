export type StorageDriver = 's3' | 'minio' | 'local' | 'disabled';

export interface StorageConfig {
  driver: StorageDriver;
  endpoint?: string | undefined;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  localPath: string;
  forcePathStyle: boolean;
  signedUrlExpirySeconds: number;
  maxImageBytes: number;
  maxDocumentBytes: number;
  maxVideoBytes: number;
  allowedImageMimes: string[];
  allowedDocumentMimes: string[];
  allowedVideoMimes: string[];
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  bucket: string;
  etag?: string;
}

export interface SignedUrlOptions {
  key: string;
  expiresIn?: number;
  method?: 'GET' | 'PUT';
}

export interface StorageHealthResult {
  healthy: boolean;
  latency?: number;
  error?: string;
}

export interface IStorageProvider {
  readonly name: string;
  isConfigured(): boolean;
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  getSignedGetUrl(options: SignedUrlOptions): Promise<string>;
  getSignedPutUrl(options: SignedUrlOptions): Promise<string>;
  checkHealth(): Promise<StorageHealthResult>;
}
