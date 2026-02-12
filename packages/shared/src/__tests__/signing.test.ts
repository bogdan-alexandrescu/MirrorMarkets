import { describe, it, expect } from 'vitest';
import {
  hashSigningPayload,
  generateCorrelationId,
  generateSigningIdempotencyKey,
  generateBindingNonce,
  isValidAddress,
  isValidSelector,
  hashBindingProof,
} from '../utils/signing.js';
import { buildBindingMessage, BINDING_MESSAGE_PREFIX } from '../types/trading-authority.js';

describe('hashSigningPayload', () => {
  it('produces deterministic SHA-256 hash', () => {
    const payload = { foo: 'bar', baz: 123 };
    const hash1 = hashSigningPayload(payload);
    const hash2 = hashSigningPayload(payload);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different payloads', () => {
    const h1 = hashSigningPayload({ a: 1 });
    const h2 = hashSigningPayload({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it('canonicalizes key order', () => {
    const h1 = hashSigningPayload({ b: 2, a: 1 });
    const h2 = hashSigningPayload({ a: 1, b: 2 });
    expect(h1).toBe(h2);
  });
});

describe('generateCorrelationId', () => {
  it('produces sig_ prefixed hex string', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^sig_[a-f0-9]{32}$/);
  });

  it('produces unique values', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).not.toBe(id2);
  });
});

describe('generateSigningIdempotencyKey', () => {
  it('produces deterministic key from inputs', () => {
    const k1 = generateSigningIdempotencyKey('user1', 'CLOB_ORDER', 'hash123');
    const k2 = generateSigningIdempotencyKey('user1', 'CLOB_ORDER', 'hash123');
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different keys for different inputs', () => {
    const k1 = generateSigningIdempotencyKey('user1', 'CLOB_ORDER', 'hash1');
    const k2 = generateSigningIdempotencyKey('user1', 'CLOB_ORDER', 'hash2');
    expect(k1).not.toBe(k2);
  });
});

describe('generateBindingNonce', () => {
  it('produces 64-char hex string', () => {
    const nonce = generateBindingNonce();
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces unique values', () => {
    const n1 = generateBindingNonce();
    const n2 = generateBindingNonce();
    expect(n1).not.toBe(n2);
  });
});

describe('isValidAddress', () => {
  it('accepts valid Ethereum address', () => {
    expect(isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
  });

  it('rejects short address', () => {
    expect(isValidAddress('0x1234')).toBe(false);
  });

  it('rejects missing prefix', () => {
    expect(isValidAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
  });
});

describe('isValidSelector', () => {
  it('accepts valid 4-byte selector', () => {
    expect(isValidSelector('0xa9059cbb')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidSelector('0xa905')).toBe(false);
  });
});

describe('hashBindingProof', () => {
  it('produces deterministic hash', () => {
    const h1 = hashBindingProof('message', '0xsig');
    const h2 = hashBindingProof('message', '0xsig');
    expect(h1).toBe(h2);
  });
});

describe('buildBindingMessage', () => {
  it('builds a structured binding message', () => {
    const msg = buildBindingMessage(
      '0xaaaa567890abcdef1234567890abcdef12345678',
      '0xbbbb567890abcdef1234567890abcdef12345678',
      'nonce123',
      1700000000,
    );

    expect(msg).toContain(BINDING_MESSAGE_PREFIX);
    expect(msg).toContain('0xaaaa567890abcdef1234567890abcdef12345678');
    expect(msg).toContain('0xbbbb567890abcdef1234567890abcdef12345678');
    expect(msg).toContain('nonce123');
    expect(msg).toContain('1700000000');
  });
});
