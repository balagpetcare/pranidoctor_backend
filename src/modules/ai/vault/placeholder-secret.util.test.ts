import { describe, expect, it } from 'vitest';

import { isPlaceholderCiphertext, PLACEHOLDER_KEY_USER_MESSAGE } from './placeholder-secret.util.js';

describe('placeholder-secret.util', () => {
  it('detects ENC:PLACEHOLDER ciphertext', () => {
    expect(isPlaceholderCiphertext('ENC:PLACEHOLDER:v1:not-a-real-api-key')).toBe(true);
  });

  it('detects ENC:SEED ciphertext', () => {
    expect(isPlaceholderCiphertext('ENC:SEED:v1:AES256GCM:placeholder-not-a-real-api-key')).toBe(
      true,
    );
  });

  it('does not flag real vault ciphertext', () => {
    expect(isPlaceholderCiphertext('v1:abc:def:ghi')).toBe(false);
  });

  it('exposes user message for test responses', () => {
    expect(PLACEHOLDER_KEY_USER_MESSAGE).toMatch(/seed\/demo/i);
  });
});
