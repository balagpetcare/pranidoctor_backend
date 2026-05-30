import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  EncryptionService,
  getEncryptionService,
  resetEncryptionServiceForTests,
} from './encryption.service.js';

describe('EncryptionService', () => {
  beforeEach(() => {
    resetEncryptionServiceForTests();
    process.env.AI_VAULT_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  afterEach(() => {
    delete process.env.AI_VAULT_MASTER_KEY;
    resetEncryptionServiceForTests();
  });

  it('encrypts and decrypts round-trip', () => {
    const service = new EncryptionService();
    const secret = 'sk-test-openai-key-1234567890abcdef';
    const { ciphertext, encryptionKeyId } = service.encrypt(secret);
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(encryptionKeyId).toBeTruthy();
    expect(service.decrypt(ciphertext)).toBe(secret);
  });

  it('rejects seed placeholders', () => {
    const service = getEncryptionService();
    expect(() => service.decrypt('ENC:SEED:v1:placeholder')).toThrow(/placeholder/i);
  });

  it('builds secret hint from last four chars', () => {
    const service = getEncryptionService();
    expect(service.buildSecretHint('sk-abcdefghijklmnop')).toBe('****mnop');
  });

  it('detects missing master key', () => {
    delete process.env.AI_VAULT_MASTER_KEY;
    resetEncryptionServiceForTests();
    expect(getEncryptionService().isMasterKeyConfigured()).toBe(false);
    expect(() => getEncryptionService().encrypt('sk-test-key-123456789012345')).toThrow(
      /AI_VAULT_MASTER_KEY/,
    );
  });
});
