import { describe, it, expect } from 'vitest';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/crypto.js';
import { randomBytes } from 'crypto';

describe('crypto utils', () => {
  const encryptionKey = randomBytes(32).toString('hex');

  it('encrypts and decrypts private key', () => {
    const privateKey = '0x' + randomBytes(32).toString('hex');
    const encrypted = encryptPrivateKey(privateKey, encryptionKey);

    expect(encrypted).not.toBe(privateKey);
    expect(encrypted).toContain(':'); // iv:tag:ciphertext format

    const decrypted = decryptPrivateKey(encrypted, encryptionKey);
    expect(decrypted).toBe(privateKey);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const privateKey = '0x' + randomBytes(32).toString('hex');
    const enc1 = encryptPrivateKey(privateKey, encryptionKey);
    const enc2 = encryptPrivateKey(privateKey, encryptionKey);

    expect(enc1).not.toBe(enc2);

    // Both should decrypt to the same value
    expect(decryptPrivateKey(enc1, encryptionKey)).toBe(privateKey);
    expect(decryptPrivateKey(enc2, encryptionKey)).toBe(privateKey);
  });

  it('fails with wrong key', () => {
    const privateKey = '0xdeadbeef';
    const encrypted = encryptPrivateKey(privateKey, encryptionKey);

    const wrongKey = randomBytes(32).toString('hex');
    expect(() => decryptPrivateKey(encrypted, wrongKey)).toThrow();
  });

  it('fails with corrupted data', () => {
    expect(() => decryptPrivateKey('invalid', encryptionKey)).toThrow();
  });
});
