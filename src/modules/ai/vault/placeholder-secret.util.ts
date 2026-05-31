/** User-facing copy when a vault row stores a non-decryptable seed/demo ciphertext. */
export const PLACEHOLDER_KEY_USER_MESSAGE =
  'This is a seed/demo key. Replace it with a real provider API key before testing.';

/**
 * Detects seeded placeholder ciphertext without attempting decryption.
 * Must stay aligned with {@link EncryptionService.decrypt} rejection prefixes.
 */
export function isPlaceholderCiphertext(ciphertext: string): boolean {
  if (!ciphertext) return false;
  return ciphertext.startsWith('ENC:PLACEHOLDER:') || ciphertext.startsWith('ENC:SEED:');
}
