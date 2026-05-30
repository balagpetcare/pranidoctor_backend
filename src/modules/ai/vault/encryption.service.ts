import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const DEFAULT_KEY_ID = 'vault:v1';
const SCRYPT_SALT = 'pranidoctor-ai-vault-v1';

export class VaultEncryptionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'VaultEncryptionError';
  }
}

export class EncryptionService {
  readonly name = 'EncryptionService';

  getKeyId(): string {
    return process.env.AI_VAULT_KEY_ID?.trim() || DEFAULT_KEY_ID;
  }

  isMasterKeyConfigured(): boolean {
    return Boolean(process.env.AI_VAULT_MASTER_KEY?.trim());
  }

  /** Derive or decode the 32-byte master key from AI_VAULT_MASTER_KEY. */
  resolveMasterKey(): Buffer {
    const raw = process.env.AI_VAULT_MASTER_KEY?.trim();
    if (!raw) {
      throw new VaultEncryptionError('AI_VAULT_MASTER_KEY is not configured', 'VAULT_MASTER_KEY_MISSING');
    }

    const asBase64 = Buffer.from(raw, 'base64');
    if (asBase64.length === 32 && /^[A-Za-z0-9+/=]+$/.test(raw)) {
      return asBase64;
    }

    return scryptSync(raw, SCRYPT_SALT, 32);
  }

  /**
   * Encrypt plaintext for storage.
   * Format: v1:{iv_b64}:{tag_b64}:{ciphertext_b64}
   */
  encrypt(plaintext: string, keyId: string = this.getKeyId()): {
    ciphertext: string;
    encryptionKeyId: string;
    encryptionAlgorithm: string;
  } {
    const key = this.resolveMasterKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`,
      encryptionKeyId: keyId,
      encryptionAlgorithm: ALGORITHM,
    };
  }

  /** Decrypt a vault ciphertext. Never log the result. */
  decrypt(ciphertext: string): string {
    if (ciphertext.startsWith('ENC:SEED:') || ciphertext.startsWith('ENC:PLACEHOLDER:')) {
      throw new VaultEncryptionError('Seed placeholder cannot be decrypted', 'VAULT_PLACEHOLDER_SECRET');
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new VaultEncryptionError('Invalid vault ciphertext format', 'VAULT_INVALID_CIPHERTEXT');
    }

    const iv = Buffer.from(parts[1]!, 'base64');
    const tag = Buffer.from(parts[2]!, 'base64');
    const data = Buffer.from(parts[3]!, 'base64');
    const key = this.resolveMasterKey();

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    try {
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      throw new VaultEncryptionError('Decryption failed — wrong master key or corrupted data', 'VAULT_DECRYPT_FAILED');
    }
  }

  buildSecretHint(plaintext: string): string {
    if (plaintext.length <= 4) return '****';
    return `****${plaintext.slice(-4)}`;
  }
}

let encryptionService: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionService) encryptionService = new EncryptionService();
  return encryptionService;
}

export function resetEncryptionServiceForTests(): void {
  encryptionService = null;
}
