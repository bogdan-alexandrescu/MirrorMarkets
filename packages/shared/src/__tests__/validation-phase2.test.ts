import { describe, it, expect } from 'vitest';
import {
  submitBindingProofSchema,
  constraintsSchema,
  enableModuleSchema,
  updateSigningModeSchema,
  registerSessionKeySchema,
  addWithdrawalAllowlistSchema,
  removeWithdrawalAllowlistSchema,
  revokeSessionKeySchema,
} from '../validation.js';

describe('submitBindingProofSchema', () => {
  const validProof = {
    embeddedWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    serverWalletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    nonce: 'abc123',
    timestamp: 1700000000,
    signature: '0xsignature',
  };

  it('accepts valid binding proof', () => {
    const result = submitBindingProofSchema.parse(validProof);
    expect(result.embeddedWalletAddress).toBe(validProof.embeddedWalletAddress);
  });

  it('rejects invalid embedded address', () => {
    expect(() => submitBindingProofSchema.parse({ ...validProof, embeddedWalletAddress: 'bad' })).toThrow();
  });

  it('rejects missing nonce', () => {
    expect(() => submitBindingProofSchema.parse({ ...validProof, nonce: '' })).toThrow();
  });
});

describe('constraintsSchema', () => {
  it('uses defaults', () => {
    const result = constraintsSchema.parse({});
    expect(result.maxNotionalPerTrade).toBe(100);
    expect(result.maxNotionalPerDay).toBe(1000);
    expect(result.maxTxPerHour).toBe(60);
    expect(result.allowedTargets).toEqual([]);
    expect(result.allowedSelectors).toEqual([]);
    expect(result.tokenAllowlist).toEqual([]);
  });

  it('accepts custom constraints', () => {
    const result = constraintsSchema.parse({
      maxNotionalPerTrade: 500,
      maxTxPerHour: 120,
    });
    expect(result.maxNotionalPerTrade).toBe(500);
    expect(result.maxTxPerHour).toBe(120);
  });

  it('validates allowedTargets are ETH addresses', () => {
    expect(() => constraintsSchema.parse({
      allowedTargets: ['invalid'],
    })).toThrow();
  });

  it('validates allowedSelectors are 4-byte selectors', () => {
    expect(() => constraintsSchema.parse({
      allowedSelectors: ['0xabc'],
    })).toThrow();

    const result = constraintsSchema.parse({
      allowedSelectors: ['0xa9059cbb'],
    });
    expect(result.allowedSelectors).toEqual(['0xa9059cbb']);
  });
});

describe('enableModuleSchema', () => {
  it('accepts valid enable request', () => {
    const result = enableModuleSchema.parse({
      safeAddress: '0x1234567890abcdef1234567890abcdef12345678',
      moduleAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      ownerSignature: '0xsig',
    });
    expect(result.safeAddress).toBeTruthy();
  });

  it('rejects invalid safe address', () => {
    expect(() => enableModuleSchema.parse({
      safeAddress: 'bad',
      moduleAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      ownerSignature: '0xsig',
    })).toThrow();
  });
});

describe('updateSigningModeSchema', () => {
  it('accepts valid signing modes', () => {
    expect(updateSigningModeSchema.parse({ signingMode: 'DYNAMIC_SERVER_WALLET' }).signingMode).toBe('DYNAMIC_SERVER_WALLET');
    expect(updateSigningModeSchema.parse({ signingMode: 'EIP1271_SAFE' }).signingMode).toBe('EIP1271_SAFE');
    expect(updateSigningModeSchema.parse({ signingMode: 'USER_EMBEDDED_WALLET' }).signingMode).toBe('USER_EMBEDDED_WALLET');
  });

  it('rejects invalid mode', () => {
    expect(() => updateSigningModeSchema.parse({ signingMode: 'INVALID' })).toThrow();
  });
});

describe('registerSessionKeySchema', () => {
  it('uses defaults', () => {
    const result = registerSessionKeySchema.parse({ constraints: {} });
    expect(result.expiresInSeconds).toBe(7 * 24 * 60 * 60); // 7 days
  });

  it('accepts custom expiry', () => {
    const result = registerSessionKeySchema.parse({ constraints: {}, expiresInSeconds: 86400 });
    expect(result.expiresInSeconds).toBe(86400);
  });

  it('rejects too short expiry', () => {
    expect(() => registerSessionKeySchema.parse({ constraints: {}, expiresInSeconds: 100 })).toThrow();
  });

  it('rejects too long expiry', () => {
    expect(() => registerSessionKeySchema.parse({ constraints: {}, expiresInSeconds: 60 * 24 * 60 * 60 })).toThrow();
  });
});

describe('addWithdrawalAllowlistSchema', () => {
  it('accepts valid address with label', () => {
    const result = addWithdrawalAllowlistSchema.parse({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      label: 'My hot wallet',
    });
    expect(result.label).toBe('My hot wallet');
  });

  it('accepts without label', () => {
    const result = addWithdrawalAllowlistSchema.parse({
      address: '0x1234567890abcdef1234567890abcdef12345678',
    });
    expect(result.label).toBeUndefined();
  });
});

describe('removeWithdrawalAllowlistSchema', () => {
  it('accepts valid address', () => {
    const result = removeWithdrawalAllowlistSchema.parse({
      address: '0x1234567890abcdef1234567890abcdef12345678',
    });
    expect(result.address).toBeTruthy();
  });
});

describe('revokeSessionKeySchema', () => {
  it('accepts valid session key id', () => {
    const result = revokeSessionKeySchema.parse({ sessionKeyId: 'sk_123' });
    expect(result.sessionKeyId).toBe('sk_123');
  });

  it('rejects empty id', () => {
    expect(() => revokeSessionKeySchema.parse({ sessionKeyId: '' })).toThrow();
  });
});
